import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { EmailService } from '../../emails/email.service';
import { UpdateStatus } from '../entities/update-status.entity';
import { DeploymentConfig } from '../../config/deployment.config';

/**
 * Pending notification stored when email delivery fails
 */
export interface PendingNotification {
  type: 'available' | 'started' | 'success' | 'failed';
  title: string;
  message: string;
  createdAt: string;
  context?: Record<string, unknown>;
}

/**
 * Service for sending update-related notifications.
 *
 * Sends emails via the configured SMTP server to the admin email address.
 * When email delivery fails, notifications are stored in the database
 * for display in the dashboard as a fallback mechanism.
 */
@Injectable()
export class UpdateNotificationService {
  private readonly logger = new Logger(UpdateNotificationService.name);
  private readonly adminEmail: string | null;
  private readonly appUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    @InjectRepository(UpdateStatus)
    private readonly updateStatusRepo: Repository<UpdateStatus>,
  ) {
    this.adminEmail = this.configService.get<string>('ADMIN_NOTIFICATION_EMAIL') || null;
    this.appUrl = this.configService.get<string>('APP_URL', 'http://localhost:3002');
  }

  /**
   * Stores a pending notification in UpdateStatus metadata when email fails.
   * These can be displayed in the dashboard as a fallback.
   */
  private async storePendingNotification(notification: PendingNotification): Promise<void> {
    try {
      const status = await this.updateStatusRepo.findOne({
        where: {},
        order: { createdAt: 'DESC' },
      });

      if (status) {
        const metadata = status.metadata || {};
        const pendingNotifications: PendingNotification[] =
          (metadata.pendingNotifications as PendingNotification[]) || [];

        // Keep only last 10 notifications
        pendingNotifications.push(notification);
        if (pendingNotifications.length > 10) {
          pendingNotifications.shift();
        }

        status.metadata = {
          ...metadata,
          pendingNotifications,
          lastNotificationFailure: new Date().toISOString(),
        };

        await this.updateStatusRepo.save(status);
        this.logger.log(`Notification stored in dashboard fallback: ${notification.type}`);
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.logger.error(`Failed to store pending notification: ${(error as any).message}`);
    }
  }

  /**
   * Retrieves and clears pending notifications for dashboard display.
   */
  async getPendingNotifications(): Promise<PendingNotification[]> {
    const status = await this.updateStatusRepo.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });

    if (!status?.metadata?.pendingNotifications) {
      return [];
    }

    return status.metadata.pendingNotifications as PendingNotification[];
  }

  /**
   * Marks pending notifications as read/acknowledged.
   */
  async clearPendingNotifications(): Promise<void> {
    const status = await this.updateStatusRepo.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });

    if (status?.metadata?.pendingNotifications) {
      status.metadata = {
        ...status.metadata,
        pendingNotifications: [],
      };
      await this.updateStatusRepo.save(status);
    }
  }

  /**
   * Handles the 'update.available' event emitted by UpdatesService.
   * Only processes in on-premise mode (updates are irrelevant in SaaS).
   *
   * @param payload - Event payload with version and changelog info
   */
  @OnEvent('update.available')
  async handleUpdateAvailable(payload: {
    currentVersion: string;
    latestVersion: string;
    changelog: string;
    releaseDate: Date;
  }): Promise<void> {
    if (!DeploymentConfig.isOnPremise) {
      return;
    }

    this.logger.log(`Update available event received: ${payload.latestVersion}`);

    let status = await this.updateStatusRepo.findOne({
      where: {},
      order: { createdAt: 'DESC' },
    });

    if (!status) {
      status = this.updateStatusRepo.create({
        currentVersion: payload.currentVersion,
        availableVersion: payload.latestVersion,
        changelog: payload.changelog,
        detectedAt: new Date(),
      });
      await this.updateStatusRepo.save(status);
    } else {
      status.availableVersion = payload.latestVersion;
      status.currentVersion = payload.currentVersion;
      status.changelog = payload.changelog;
      status.detectedAt = new Date();
      await this.updateStatusRepo.save(status);
    }

    await this.sendUpdateAvailableEmail(status);
  }

  /**
   * Sends notification when a new update is available.
   * Falls back to dashboard notification if email fails.
   */
  async sendUpdateAvailableEmail(update: UpdateStatus): Promise<void> {
    const notificationContext = {
      currentVersion: update.currentVersion,
      newVersion: update.availableVersion,
      changelog: update.changelog,
      dashboardUrl: `${this.appUrl}/admin/updates`,
      hasBreakingChanges: update.changelog?.includes('BREAKING'),
    };

    if (!this.adminEmail) {
      this.logger.warn('No admin notification email configured, storing in dashboard');
      await this.storePendingNotification({
        type: 'available',
        title: `Update ${update.availableVersion} available`,
        message: `A new version is available. Current: ${update.currentVersion}, New: ${update.availableVersion}`,
        createdAt: new Date().toISOString(),
        context: notificationContext,
      });
      return;
    }

    try {
      await this.emailService.sendEmail({
        to: this.adminEmail,
        subject: `[Flowly] Update ${update.availableVersion} available`,
        template: 'updates/update-available',
        context: notificationContext,
      });

      this.logger.log(`Update available email sent to ${this.adminEmail}`);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.logger.error(`Failed to send update available email: ${(error as any).message}`);

      // Fallback: store notification for dashboard display
      await this.storePendingNotification({
        type: 'available',
        title: `Update ${update.availableVersion} available`,
        message: `A new version is available. Current: ${update.currentVersion}, New: ${update.availableVersion}. Email delivery failed.`,
        createdAt: new Date().toISOString(),
        context: notificationContext,
      });
    }
  }

  /**
   * Sends notification when an update completes successfully.
   * Falls back to dashboard notification if email fails.
   */
  async sendUpdateSuccessEmail(update: UpdateStatus): Promise<void> {
    const notificationContext = {
      newVersion: update.currentVersion,
      completedAt: new Date().toISOString(),
      dashboardUrl: `${this.appUrl}/admin/updates`,
    };

    if (!this.adminEmail) {
      await this.storePendingNotification({
        type: 'success',
        title: `Update to ${update.currentVersion} completed`,
        message: `The system has been successfully updated to version ${update.currentVersion}.`,
        createdAt: new Date().toISOString(),
        context: notificationContext,
      });
      return;
    }

    try {
      await this.emailService.sendEmail({
        to: this.adminEmail,
        subject: `[Flowly] Update to ${update.currentVersion} completed`,
        template: 'updates/update-success',
        context: notificationContext,
      });

      this.logger.log(`Update success email sent to ${this.adminEmail}`);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.logger.error(`Failed to send update success email: ${(error as any).message}`);

      await this.storePendingNotification({
        type: 'success',
        title: `Update to ${update.currentVersion} completed`,
        message: `Update successful. Email delivery failed.`,
        createdAt: new Date().toISOString(),
        context: notificationContext,
      });
    }
  }

  /**
   * Sends notification when an update fails.
   * Falls back to dashboard notification if email fails.
   *
   * This is critical - we always store in dashboard as backup for failures.
   */
  async sendUpdateFailedEmail(update: UpdateStatus, errorMessage: string): Promise<void> {
    const notificationContext = {
      currentVersion: update.currentVersion,
      targetVersion: update.availableVersion,
      errorMessage,
      failedAt: new Date().toISOString(),
      dashboardUrl: `${this.appUrl}/admin/updates`,
      rollbackPerformed: true,
    };

    // Always store failure notifications in dashboard (critical info)
    await this.storePendingNotification({
      type: 'failed',
      title: `Update to ${update.availableVersion} failed`,
      message: `Update failed: ${errorMessage}. Automatic rollback was performed.`,
      createdAt: new Date().toISOString(),
      context: notificationContext,
    });

    if (!this.adminEmail) {
      this.logger.warn('No admin email configured - failure notification stored in dashboard only');
      return;
    }

    try {
      await this.emailService.sendEmail({
        to: this.adminEmail,
        subject: `[Flowly] Update to ${update.availableVersion} failed`,
        template: 'updates/update-failed',
        context: notificationContext,
      });

      this.logger.log(`Update failed email sent to ${this.adminEmail}`);
    } catch (error) {
      this.logger.error(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        `Failed to send update failed email: ${(error as any).message} (notification stored in dashboard)`,
      );
    }
  }
}
