import { Injectable, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

import { UpdateStatus, UpdateState } from '../entities/update-status.entity';
import { UpdateHistory, UpdateResult, BackupInfo } from '../entities/update-history.entity';
import { LicensingService } from '../../licensing/licensing.service';
import { UpdateNotificationService } from './update-notification.service';
import { WatchtowerClientService } from './watchtower-client.service';

const execAsync = promisify(exec);

/**
 * Service that orchestrates the entire update process.
 *
 * Handles:
 * - License validation
 * - Pre-update backups
 * - Database migrations
 * - Watchtower trigger
 * - Health checks
 * - Automatic rollback on failure
 */
@Injectable()
export class UpdateOrchestratorService {
  private readonly logger = new Logger(UpdateOrchestratorService.name);
  private readonly installDir: string;
  private readonly backupDir: string;

  /**
   * Health check configuration (configurable via environment)
   */
  private readonly healthCheckMaxAttempts: number;
  private readonly healthCheckIntervalMs: number;

  /**
   * Service URLs for health checks (configurable via environment)
   */
  private readonly apiHealthUrl: string;
  private readonly dashboardHealthUrl: string;
  private readonly pluginHealthUrl: string;

  /**
   * Backup retention configuration
   */
  private readonly backupRetentionCount: number;

  constructor(
    @InjectRepository(UpdateStatus)
    private readonly updateStatusRepo: Repository<UpdateStatus>,
    @InjectRepository(UpdateHistory)
    private readonly updateHistoryRepo: Repository<UpdateHistory>,
    private readonly configService: ConfigService,
    private readonly licensingService: LicensingService,
    private readonly notificationService: UpdateNotificationService,
    private readonly watchtowerClient: WatchtowerClientService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.installDir = this.configService.get<string>('FLOWLY_INSTALL_DIR', '/opt/flowly');
    this.backupDir = path.join(this.installDir, 'backups');

    // Health check configuration with sensible defaults for large instances
    // Default: 20 attempts × 30s = 10 minutes total wait time
    this.healthCheckMaxAttempts = this.configService.get<number>(
      'UPDATE_HEALTH_CHECK_ATTEMPTS',
      20,
    );
    this.healthCheckIntervalMs = this.configService.get<number>(
      'UPDATE_HEALTH_CHECK_INTERVAL_MS',
      30000,
    );

    // Service URLs for health checks (must match docker-compose port mappings)
    const apiPort = this.configService.get<number>('PORT', 3000);
    this.apiHealthUrl = this.configService.get<string>(
      'UPDATE_API_HEALTH_URL',
      `http://localhost:${apiPort}/api/health`,
    );
    this.dashboardHealthUrl = this.configService.get<string>(
      'UPDATE_DASHBOARD_HEALTH_URL',
      'http://localhost:3002',
    );
    this.pluginHealthUrl = this.configService.get<string>(
      'UPDATE_PLUGIN_HEALTH_URL',
      'http://localhost:3003/manifest.json',
    );

    // Backup retention: keep last N backups (default: 5)
    this.backupRetentionCount = this.configService.get<number>('UPDATE_BACKUP_RETENTION_COUNT', 5);
  }

  /**
   * Executes the complete update process.
   *
   * @param approvedBy - User ID or identifier who approved the update
   * @returns Update result
   */
  async executeUpdate(approvedBy: string): Promise<UpdateResult> {
    const startTime = new Date();
    let history: UpdateHistory | null = null;
    let backup: BackupInfo | null = null;

    try {
      // Get current status
      const status = await this.getOrCreateStatus();

      if (status.state !== UpdateState.APPROVED) {
        throw new BadRequestException('Update must be approved before execution');
      }

      // 1. Validate license
      this.logger.log('Step 1/6: Validating license...');
      const licenseValid = await this.validateLicenseStatus();
      if (!licenseValid) {
        throw new ForbiddenException('License expired or invalid');
      }

      // Update state
      await this.updateState(status, UpdateState.IN_PROGRESS, {
        startedAt: startTime,
      });

      // Create history record
      history = await this.createHistoryRecord(
        status.currentVersion,
        status.availableVersion,
        approvedBy,
      );

      // 2. Create backup
      this.logger.log('Step 2/6: Creating backup...');
      backup = await this.createBackup();
      history.backupInfo = backup;
      await this.updateHistoryRepo.save(history);

      // 3. Execute pre-update hook (migrations)
      this.logger.log('Step 3/6: Running pre-update hook...');
      await this.executePreUpdateHook();

      // 4. Trigger Watchtower
      this.logger.log('Step 4/6: Triggering container update...');
      await this.triggerWatchtowerUpdate();

      // 5. Wait for health check
      this.logger.log('Step 5/6: Waiting for services to be healthy...');
      const healthy = await this.waitForHealthyState();

      // 6. Complete or rollback
      if (!healthy) {
        this.logger.warn('Health check failed - initiating rollback');
        await this.rollback(backup);

        // Update records
        await this.updateState(status, UpdateState.ROLLED_BACK, {
          errorMessage: 'Health check failed after update',
          completedAt: new Date(),
        });

        history.result = UpdateResult.ROLLED_BACK;
        history.errorMessage = 'Health check failed after update';
        history.completedAt = new Date();
        history.durationSeconds = Math.round((Date.now() - startTime.getTime()) / 1000);
        await this.updateHistoryRepo.save(history);

        // Notify failure
        await this.notificationService.sendUpdateFailedEmail(
          status,
          'Health check failed after update - automatic rollback performed',
        );

        return UpdateResult.ROLLED_BACK;
      }

      // Success
      this.logger.log('Step 6/6: Update completed successfully');

      await this.updateState(status, UpdateState.COMPLETED, {
        currentVersion: status.availableVersion,
        availableVersion: undefined,
        completedAt: new Date(),
        errorMessage: undefined,
      });

      history.result = UpdateResult.SUCCESS;
      history.completedAt = new Date();
      history.durationSeconds = Math.round((Date.now() - startTime.getTime()) / 1000);
      await this.updateHistoryRepo.save(history);

      // Notify success
      await this.notificationService.sendUpdateSuccessEmail(status);

      // Emit event
      this.eventEmitter.emit('update.completed', {
        fromVersion: history.fromVersion,
        toVersion: history.toVersion,
        duration: history.durationSeconds,
      });

      return UpdateResult.SUCCESS;
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      this.logger.error(`Update failed: ${err.message}`, err.stack);

      // Attempt rollback if backup exists
      if (backup) {
        this.logger.warn('Attempting rollback due to error');
        try {
          await this.rollback(backup);
        } catch (rollbackError) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          this.logger.error(`Rollback also failed: ${(rollbackError as any).message}`);
        }
      }

      // Update status
      const status = await this.getOrCreateStatus();
      await this.updateState(status, UpdateState.FAILED, {
        errorMessage: err.message,
        completedAt: new Date(),
      });

      // Update history if exists
      if (history) {
        history.result = UpdateResult.FAILED;
        history.errorMessage = err.message;
        history.completedAt = new Date();
        history.durationSeconds = Math.round((Date.now() - startTime.getTime()) / 1000);
        await this.updateHistoryRepo.save(history);
      }

      // Notify failure
      await this.notificationService.sendUpdateFailedEmail(status, err.message);

      throw error;
    }
  }

  /**
   * Creates a pre-update backup.
   */
  private async createBackup(): Promise<BackupInfo> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `pre-update-${timestamp}`);
    const dbDumpPath = path.join(backupPath, 'database.sql.gz');

    const dbUser = this.configService.get<string>('DB_USER', 'postgres');
    const dbName = this.configService.get<string>('DB_NAME', 'flowly');

    // Create backup directory
    await fs.mkdir(backupPath, { recursive: true });

    // Backup database
    this.logger.log(`Creating database backup (${dbName})...`);
    const composeFile = path.join(this.installDir, 'docker-compose.yml');
    await execAsync(
      `docker compose -f ${composeFile} exec -T postgres pg_dump -U ${dbUser} ${dbName} | gzip > ${dbDumpPath}`,
      { timeout: 300000 }, // 5 minutes for large databases
    );

    // Backup config
    await fs.copyFile(path.join(this.installDir, '.env'), path.join(backupPath, '.env'));
    await fs.copyFile(
      path.join(this.installDir, 'docker-compose.yml'),
      path.join(backupPath, 'docker-compose.yml'),
    );

    // Get backup size
    const stat = await fs.stat(dbDumpPath);

    this.logger.log(`Backup created at ${backupPath}`);

    // Cleanup old backups (non-blocking)
    this.cleanupOldBackups().catch((error) => {
      this.logger.warn(`Failed to cleanup old backups: ${error.message}`);
    });

    return {
      path: backupPath,
      size: stat.size,
      dbDumpPath,
      createdAt: new Date(),
    };
  }

  /**
   * Removes old backups, keeping only the most recent ones.
   *
   * Retention count is configurable via UPDATE_BACKUP_RETENTION_COUNT (default: 5).
   * Backups are sorted by modification time, oldest deleted first.
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });

      // List all backup directories
      const entries = await fs.readdir(this.backupDir, { withFileTypes: true });
      const backupDirs = entries
        .filter((e) => e.isDirectory() && e.name.startsWith('pre-update-'))
        .map((e) => e.name);

      if (backupDirs.length <= this.backupRetentionCount) {
        this.logger.debug(
          `${backupDirs.length} backups found, retention is ${this.backupRetentionCount} - no cleanup needed`,
        );
        return;
      }

      // Get modification times and sort by oldest first
      const backupsWithTime = await Promise.all(
        backupDirs.map(async (name) => {
          const fullPath = path.join(this.backupDir, name);
          const stat = await fs.stat(fullPath);
          return { name, path: fullPath, mtime: stat.mtime.getTime() };
        }),
      );

      backupsWithTime.sort((a, b) => a.mtime - b.mtime);

      // Delete oldest backups beyond retention count
      const toDelete = backupsWithTime.slice(0, backupsWithTime.length - this.backupRetentionCount);

      for (const backup of toDelete) {
        this.logger.log(`Deleting old backup: ${backup.name}`);
        await fs.rm(backup.path, { recursive: true, force: true });
      }

      this.logger.log(
        `Cleaned up ${toDelete.length} old backup(s), ${this.backupRetentionCount} retained`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Backup cleanup failed: ${message}`);
      // Don't throw - cleanup failure shouldn't block updates
    }
  }

  /**
   * Executes the pre-update hook (migrations).
   */
  private async executePreUpdateHook(): Promise<void> {
    const hookPath = path.join(this.installDir, 'scripts', 'pre-update-hook.sh');

    try {
      await fs.access(hookPath);
      await execAsync(`bash ${hookPath}`, {
        cwd: this.installDir,
        timeout: 300000, // 5 minutes
      });
      this.logger.log('Pre-update hook executed successfully');
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      if (err.code === 'ENOENT') {
        this.logger.warn('No pre-update hook found, skipping');
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throw new (Error as any)(
          `Pre-update hook failed: ${error instanceof Error ? error.message : error}`,
          { cause: error },
        );
      }
    }
  }

  /**
   * Triggers Watchtower to update containers.
   *
   * Uses the WatchtowerClientService (axios) instead of curl to avoid
   * exposing the token in shell command history or /proc.
   */
  private async triggerWatchtowerUpdate(): Promise<void> {
    try {
      // Force scan to bypass cooldown - we're applying an approved update
      const result = await this.watchtowerClient.triggerScan(true);
      this.logger.log(`Watchtower update triggered: ${result.scanned} containers scanned`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      throw new (Error as any)(`Failed to trigger Watchtower: ${message}`, { cause: error });
    }
  }

  /**
   * Waits for all services to become healthy.
   *
   * Configuration via environment variables:
   * - UPDATE_HEALTH_CHECK_ATTEMPTS: Number of attempts (default: 20)
   * - UPDATE_HEALTH_CHECK_INTERVAL_MS: Interval between attempts in ms (default: 30000)
   */
  private async waitForHealthyState(): Promise<boolean> {
    const maxAttempts = this.healthCheckMaxAttempts;
    const intervalMs = this.healthCheckIntervalMs;

    this.logger.log(
      `Starting health checks (max ${maxAttempts} attempts, ${intervalMs / 1000}s interval)`,
    );

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.logger.log(`Health check attempt ${attempt}/${maxAttempts}`);

      try {
        // Check API health
        this.logger.debug(`Checking API: ${this.apiHealthUrl}`);
        await execAsync(`curl -s -f "${this.apiHealthUrl}"`, {
          timeout: 10000,
        });

        // Check dashboard
        this.logger.debug(`Checking Dashboard: ${this.dashboardHealthUrl}`);
        await execAsync(`curl -s -f "${this.dashboardHealthUrl}"`, {
          timeout: 10000,
        });

        // Check plugin
        this.logger.debug(`Checking Plugin: ${this.pluginHealthUrl}`);
        await execAsync(`curl -s -f "${this.pluginHealthUrl}"`, {
          timeout: 10000,
        });

        this.logger.log('All services healthy (API, Dashboard, Plugin)');
        return true;
      } catch {
        if (attempt < maxAttempts) {
          this.logger.warn(`Health check failed, waiting ${intervalMs / 1000}s before retry`);
          await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
      }
    }

    return false;
  }

  /**
   * Performs rollback to the backup.
   *
   * Database restoration strategy:
   * 1. Stop all application services (API, Dashboard, Plugin)
   * 2. Keep only PostgreSQL running
   * 3. Drop and recreate database to ensure clean state
   * 4. Restore from backup
   * 5. Restore config files
   * 6. Restart all services
   */
  async rollback(backup: BackupInfo): Promise<void> {
    this.logger.log('Starting rollback...');

    const composeFile = path.join(this.installDir, 'docker-compose.yml');
    const dbUser = this.configService.get<string>('DB_USER', 'postgres');
    const dbName = this.configService.get<string>('DB_NAME', 'flowly');

    try {
      // Step 1: Stop application services (keep postgres running)
      this.logger.log('Stopping application services...');
      await execAsync(
        `docker compose -f ${composeFile} stop flowly-api flowly-dashboard flowly-plugin watchtower`,
      );

      // Step 2: Terminate active connections to the database
      this.logger.log('Terminating database connections...');
      await execAsync(
        `docker compose -f ${composeFile} exec -T postgres psql -U ${dbUser} -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid();"`,
      ).catch(() => {
        // Ignore errors - connections may not exist
        this.logger.debug('No active connections to terminate');
      });

      // Step 3: Drop and recreate database
      this.logger.log('Recreating database...');
      await execAsync(
        `docker compose -f ${composeFile} exec -T postgres psql -U ${dbUser} -c "DROP DATABASE IF EXISTS ${dbName};"`,
      );
      await execAsync(
        `docker compose -f ${composeFile} exec -T postgres psql -U ${dbUser} -c "CREATE DATABASE ${dbName} OWNER ${dbUser};"`,
      );

      // Step 4: Restore database from backup
      this.logger.log('Restoring database from backup...');
      await execAsync(
        `gunzip -c ${backup.dbDumpPath} | docker compose -f ${composeFile} exec -T postgres psql -U ${dbUser} ${dbName}`,
        { timeout: 300000 }, // 5 minutes for large databases
      );

      // Step 5: Restore config files
      this.logger.log('Restoring configuration files...');
      await fs.copyFile(path.join(backup.path, '.env'), path.join(this.installDir, '.env'));
      await fs.copyFile(
        path.join(backup.path, 'docker-compose.yml'),
        path.join(this.installDir, 'docker-compose.yml'),
      );

      // Step 6: Restart all services
      this.logger.log('Restarting all services...');
      await execAsync(`docker compose -f ${composeFile} up -d`);

      this.logger.log('Rollback completed successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Rollback failed: ${message}`);

      // Try to restart services even if rollback partially failed
      await execAsync(`docker compose -f ${composeFile} up -d`).catch(() => {
        this.logger.error('Failed to restart services after rollback error');
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      throw new (Error as any)(`Rollback failed: ${message}`, { cause: error });
    }
  }

  /**
   * Validates the current license.
   */
  private async validateLicenseStatus(): Promise<boolean> {
    try {
      const result = await this.licensingService.validateLicense();
      return result.valid;
    } catch {
      return false;
    }
  }

  /**
   * Gets or creates the singleton UpdateStatus record.
   */
  async getOrCreateStatus(): Promise<UpdateStatus> {
    let status = await this.updateStatusRepo.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });

    if (!status) {
      const currentVersion = this.configService.get<string>('APP_VERSION', '1.0.0');

      status = this.updateStatusRepo.create({
        currentVersion,
        state: UpdateState.UP_TO_DATE,
      });
      status = await this.updateStatusRepo.save(status);
    }

    return status;
  }

  /**
   * Updates the status record.
   */
  private async updateState(
    status: UpdateStatus,
    state: UpdateState,
    data: Partial<UpdateStatus> = {},
  ): Promise<UpdateStatus> {
    status.state = state;
    Object.assign(status, data);
    return this.updateStatusRepo.save(status);
  }

  /**
   * Creates a history record for the update.
   */
  private async createHistoryRecord(
    fromVersion: string,
    toVersion: string,
    triggeredBy: string,
  ): Promise<UpdateHistory> {
    const history = this.updateHistoryRepo.create({
      fromVersion,
      toVersion,
      triggeredBy,
      triggerSource: 'dashboard',
      startedAt: new Date(),
      result: UpdateResult.FAILED, // Will be updated on success
    });

    return this.updateHistoryRepo.save(history);
  }
}
