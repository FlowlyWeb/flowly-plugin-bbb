import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UpdatesService } from './updates.service';
import { UpdateOrchestratorService } from './services/update-orchestrator.service';
import { UpdateNotificationService } from './services/update-notification.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OnPremiseOnlyGuard } from '../common/guards/onpremise-only.guard';
import { ApproveUpdateDto } from './dto/approve-update.dto';
import { safeCompare } from '../common/utils/safe-compare';
import { UpdateState } from './entities/update-status.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateStatus } from './entities/update-status.entity';
import { UpdateHistory } from './entities/update-history.entity';

/**
 * Updates controller for flowly-api (on-premise)
 *
 * Provides endpoints for update management:
 * - Status check
 * - Manual update check
 * - Update approval
 * - Rollback
 * - History
 *
 * All endpoints require authentication and are only available in on-premise mode.
 */
@ApiTags('admin/updates')
@Controller('admin/updates')
@UseGuards(JwtAuthGuard, OnPremiseOnlyGuard)
@ApiBearerAuth()
export class UpdatesController {
  constructor(
    private readonly updatesService: UpdatesService,
    private readonly orchestratorService: UpdateOrchestratorService,
    private readonly notificationService: UpdateNotificationService,
    @InjectRepository(UpdateStatus)
    private readonly updateStatusRepo: Repository<UpdateStatus>,
    @InjectRepository(UpdateHistory)
    private readonly updateHistoryRepo: Repository<UpdateHistory>,
  ) {}

  /**
   * Get current update status
   *
   * Returns the current update state including available version and changelog.
   */
  @Get('status')
  @ApiOperation({
    summary: 'Get current update status',
    description: 'Returns current version, available updates, and state',
  })
  @ApiResponse({
    status: 200,
    description: 'Update status retrieved successfully',
  })
  async getStatus() {
    const status = await this.orchestratorService.getOrCreateStatus();
    const lastCheck = this.updatesService.getLastCheckTime();

    return {
      currentVersion: status.currentVersion,
      availableVersion: status.availableVersion,
      state: status.state,
      changelog: status.changelog,
      lastCheckAt: status.lastCheckAt || lastCheck,
      updateAvailable: status.state === UpdateState.AVAILABLE,
      detectedAt: status.detectedAt,
      approvedAt: status.approvedAt,
      approvedBy: status.approvedBy,
    };
  }

  /**
   * Trigger manual update check
   *
   * Forces a fresh check with flowly-core for available updates.
   */
  @Post('check')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check for updates',
    description: 'Manually trigger update check with flowly-core',
  })
  @ApiResponse({
    status: 200,
    description: 'Update check completed',
  })
  async checkForUpdates() {
    const result = await this.updatesService.checkForUpdates();

    // Update status if update available
    if (result.updateAvailable) {
      const status = await this.orchestratorService.getOrCreateStatus();

      if (status.availableVersion !== result.latestVersion) {
        status.availableVersion = result.latestVersion || '';
        status.changelog = result.changelog || '';
        status.state = UpdateState.AVAILABLE;
        status.detectedAt = new Date();
        status.lastCheckAt = new Date();
        await this.updateStatusRepo.save(status);
      }
    }

    return {
      success: true,
      updateAvailable: result.updateAvailable,
      latestVersion: result.latestVersion,
      currentVersion: result.currentVersion,
      changelog: result.changelog,
      message: result.message,
    };
  }

  /**
   * Approve and trigger update
   *
   * Approves the available update and starts the update process.
   */
  @Post('approve')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Approve and start update',
    description: 'Approves the pending update and triggers the update process',
  })
  @ApiResponse({
    status: 202,
    description: 'Update approved and started',
  })
  @ApiResponse({
    status: 400,
    description: 'No update available or already in progress',
  })
  async approveUpdate(
    @Request() req: { user: { userId: string; email: string } },
    @Body() _dto: ApproveUpdateDto,
  ) {
    const status = await this.orchestratorService.getOrCreateStatus();

    // Validate state
    if (status.state === UpdateState.IN_PROGRESS) {
      return {
        success: false,
        message: 'Update already in progress',
      };
    }

    if (status.state !== UpdateState.AVAILABLE && status.state !== UpdateState.FAILED) {
      return {
        success: false,
        message: 'No update available to approve',
      };
    }

    // Mark as approved
    status.state = UpdateState.APPROVED;
    status.approvedAt = new Date();
    status.approvedBy = req.user.email || req.user.userId;
    await this.updateStatusRepo.save(status);

    // Execute update (async, don't wait for completion)
    this.orchestratorService.executeUpdate(req.user.email || req.user.userId).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Update failed:', error.message);
    });

    return {
      success: true,
      message: 'Update approved and started',
      state: UpdateState.IN_PROGRESS,
    };
  }

  /**
   * Trigger manual rollback
   *
   * Rolls back to the previous version using the last backup.
   */
  @Post('rollback')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Rollback to previous version',
    description: 'Rolls back to the previous version using the last backup',
  })
  @ApiResponse({
    status: 202,
    description: 'Rollback initiated',
  })
  async rollback(@Request() _req: { user: { userId: string; email: string } }) {
    // Get last successful update with backup info
    const lastUpdate = await this.updateHistoryRepo.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });

    if (!lastUpdate?.backupInfo) {
      return {
        success: false,
        message: 'No backup available for rollback',
      };
    }

    // Execute rollback
    await this.orchestratorService.rollback(lastUpdate.backupInfo);

    return {
      success: true,
      message: 'Rollback completed',
      restoredVersion: lastUpdate.fromVersion,
    };
  }

  /**
   * Get update history
   *
   * Returns the history of all update attempts.
   */
  @Get('history')
  @ApiOperation({
    summary: 'Get update history',
    description: 'Returns the history of all update attempts',
  })
  @ApiResponse({
    status: 200,
    description: 'Update history retrieved successfully',
  })
  async getHistory() {
    const history = await this.updateHistoryRepo.find({
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return {
      success: true,
      data: history.map((h) => ({
        id: h.id,
        fromVersion: h.fromVersion,
        toVersion: h.toVersion,
        result: h.result,
        startedAt: h.startedAt,
        completedAt: h.completedAt,
        durationSeconds: h.durationSeconds,
        triggeredBy: h.triggeredBy,
        triggerSource: h.triggerSource,
        errorMessage: h.errorMessage,
      })),
    };
  }

  /**
   * Get pending notifications
   *
   * Returns notifications that failed to be sent via email.
   * Useful for dashboard display when SMTP is unavailable.
   */
  @Get('notifications')
  @ApiOperation({
    summary: 'Get pending notifications',
    description: 'Returns update notifications stored when email delivery failed',
  })
  @ApiResponse({
    status: 200,
    description: 'Pending notifications retrieved',
  })
  async getNotifications() {
    const notifications = await this.notificationService.getPendingNotifications();

    return {
      success: true,
      count: notifications.length,
      data: notifications,
    };
  }

  /**
   * Clear pending notifications
   *
   * Marks all pending notifications as acknowledged.
   */
  @Post('notifications/clear')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Clear pending notifications',
    description: 'Marks pending notifications as acknowledged',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications cleared',
  })
  async clearNotifications() {
    await this.notificationService.clearPendingNotifications();

    return {
      success: true,
      message: 'Notifications cleared',
    };
  }
}

/**
 * Internal webhook controller for Watchtower notifications.
 *
 * Protected by the same token used for Watchtower API (WATCHTOWER_TOKEN).
 * This prevents unauthorized parties on the network from triggering update checks.
 */
@ApiTags('internal/updates')
@Controller('internal/updates')
export class UpdatesWebhookController {
  private readonly webhookToken: string | null;

  constructor(
    private readonly updatesService: UpdatesService,
    private readonly configService: ConfigService,
    @InjectRepository(UpdateStatus)
    private readonly updateStatusRepo: Repository<UpdateStatus>,
  ) {
    this.webhookToken = this.configService.get<string>('WATCHTOWER_TOKEN') || null;
  }

  /**
   * Validates the webhook authorization token.
   * Accepts both "Bearer <token>" and plain "<token>" formats.
   */
  private validateToken(authHeader: string | undefined): void {
    if (!this.webhookToken) {
      // No token configured: the webhook is disabled
      throw new UnauthorizedException('Webhook is not configured');
    }

    if (!authHeader) {
      throw new UnauthorizedException('Missing Authorization header');
    }

    // Extract token (support both "Bearer <token>" and plain "<token>")
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

    if (!safeCompare(token, this.webhookToken)) {
      throw new UnauthorizedException('Invalid webhook token');
    }
  }

  /**
   * Webhook endpoint for Watchtower notifications.
   *
   * Called by Watchtower when new images are detected.
   * Requires the same token as WATCHTOWER_TOKEN for authentication.
   *
   * @example
   * curl -X POST http://localhost:3000/api/internal/updates/webhook \
   *   -H "Authorization: Bearer your-watchtower-token"
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Watchtower webhook',
    description:
      'Receives notifications from Watchtower about new images. Requires WATCHTOWER_TOKEN.',
  })
  async handleWatchtowerWebhook(
    @Headers('authorization') authHeader: string,
    @Body() _payload: unknown,
  ) {
    // Validate token
    this.validateToken(authHeader);

    // Trigger update check when Watchtower detects new images
    await this.updatesService.checkForUpdates();

    return { received: true };
  }
}
