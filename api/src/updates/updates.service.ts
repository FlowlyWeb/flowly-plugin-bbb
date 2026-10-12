import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WatchtowerClientService } from './services/watchtower-client.service';
import { DockerInspectionService } from './services/docker-inspection.service';
import { ChangelogService } from './services/changelog.service';

/**
 * Update check response
 */
export interface UpdateCheckResponse {
  updateAvailable: boolean;
  latestVersion?: string;
  currentVersion: string;
  changelog?: string;
  releaseDate?: Date;
  message?: string;
}

/**
 * Updates service for flowly-api (on-premise)
 *
 * Detects available updates via Watchtower and Docker image inspection.
 * When an update is available, emits an event for notification purposes.
 *
 * Responsibilities:
 * - Trigger Watchtower scans and parse results
 * - Inspect Docker images for version and changelog info
 * - Emit events when updates are available
 * - Provide cached update status to dashboard
 */
@Injectable()
export class UpdatesService {
  private readonly logger = new Logger(UpdatesService.name);
  private readonly currentVersion: string;

  private lastUpdateCheck: UpdateCheckResponse | null = null;
  private lastCheckTime: Date | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly watchtowerClient: WatchtowerClientService,
    private readonly dockerInspection: DockerInspectionService,
    private readonly changelogService: ChangelogService,
  ) {
    this.currentVersion = this.configService.get<string>('APP_VERSION', '1.0.0');
  }

  /**
   * Check for updates via Watchtower
   *
   * 1. Trigger Watchtower scan (monitor-only — does not apply updates)
   * 2. If updates detected, inspect Docker images for version info
   * 3. Retrieve changelog from Docker labels, fallback to generic message
   * 4. Compare versions with semver to confirm the update is newer
   *
   * Emits 'update.available' event if a new version is confirmed.
   * On error, returns cached result if available.
   *
   * @returns Update check response
   */
  async checkForUpdates(): Promise<UpdateCheckResponse> {
    this.logger.log('Checking for updates with Watchtower...');

    try {
      // Trigger scan — triggerScan() handles connectivity errors internally
      // and returns cached results when the API is temporarily unreachable
      const scanResult = await this.watchtowerClient.triggerScan();

      // No updates detected by Watchtower
      if (!scanResult.updateAvailable) {
        const result: UpdateCheckResponse = {
          updateAvailable: false,
          currentVersion: this.currentVersion,
          message: `No updates available. Last scan: ${scanResult.scanned} containers checked.`,
        };

        this.lastUpdateCheck = result;
        this.lastCheckTime = new Date();
        this.logger.log('No updates available');

        return result;
      }

      // Updates detected - get version information
      this.logger.log(`Watchtower detected ${scanResult.updated} available updates`);

      // Inspect Docker IMAGE (not container) to get available version
      // After Watchtower pulls in monitor-only mode, the new image is local
      // but the container still runs the old version
      const latestVersion = await this.dockerInspection.getAvailableImageVersion('flowly-api');

      if (!latestVersion) {
        this.logger.warn(
          'Could not determine latest version from Docker image. ' +
            'Ensure images are built with version labels (org.opencontainers.image.version)',
        );
        return {
          updateAvailable: true,
          currentVersion: this.currentVersion,
          message: 'Update available (version unknown - check image labels)',
        };
      }

      // Compare versions to ensure it's actually newer
      const isNewer = this.dockerInspection.compareVersions(this.currentVersion, latestVersion);

      if (!isNewer) {
        this.logger.warn(
          `Watchtower reported update but version is not newer: ${latestVersion} <= ${this.currentVersion}`,
        );
        return {
          updateAvailable: false,
          currentVersion: this.currentVersion,
          message: 'System is up to date',
        };
      }

      // Get changelog from Docker labels
      const imageName = this.dockerInspection.buildImageName('api', latestVersion);
      let changelog = await this.changelogService.getChangelogFromImage(imageName);

      // Fallback to generic changelog if not found
      if (!changelog) {
        this.logger.debug('No changelog found in Docker labels');
        changelog = `## Version ${latestVersion}\n\nChangelog not available. Please refer to release documentation.`;
      }

      const result: UpdateCheckResponse = {
        updateAvailable: true,
        latestVersion,
        currentVersion: this.currentVersion,
        changelog,
        releaseDate: new Date(), // Watchtower scan time as proxy for release date
        message: `Update available: ${latestVersion}`,
      };

      // Cache result
      this.lastUpdateCheck = result;
      this.lastCheckTime = new Date();

      // Emit event
      this.logger.log(`Update available: ${latestVersion} (current: ${this.currentVersion})`);

      this.eventEmitter.emit('update.available', {
        currentVersion: this.currentVersion,
        latestVersion: result.latestVersion,
        changelog: result.changelog,
        releaseDate: result.releaseDate,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Watchtower update check failed: ${errorMessage}`);

      // Return cached result if available
      if (this.lastUpdateCheck) {
        this.logger.warn('Using cached update check due to error');
        return this.lastUpdateCheck;
      }

      // No cache - return error response
      return {
        updateAvailable: false,
        currentVersion: this.currentVersion,
        message: 'Update check temporarily unavailable',
      };
    }
  }

  /**
   * Get current update status
   *
   * Returns cached update check without making a new request.
   * Returns null if no check has been performed yet.
   *
   * @returns Cached update check or null
   */
  getUpdateStatus(): UpdateCheckResponse | null {
    return this.lastUpdateCheck;
  }

  /**
   * Get last check time
   *
   * @returns Date of last update check or null
   */
  getLastCheckTime(): Date | null {
    return this.lastCheckTime;
  }

  /**
   * Check if an update is currently available
   *
   * @returns true if an update is available
   */
  isUpdateAvailable(): boolean {
    return this.lastUpdateCheck?.updateAvailable || false;
  }

  /**
   * Get current application version
   *
   * @returns Current version string
   */
  getCurrentVersion(): string {
    return this.currentVersion;
  }
}
