import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UpdatesService } from './updates.service';

/**
 * Updates scheduler for flowly-api (on-premise)
 *
 * Runs daily update checks at 3:00 AM local time.
 * This ensures on-premise installations are notified of available updates.
 */
@Injectable()
export class UpdatesScheduler {
  private readonly logger = new Logger(UpdatesScheduler.name);

  constructor(private readonly updatesService: UpdatesService) {}

  /**
   * Daily update check at 3:00 AM
   *
   * Checks for updates and emits events if new versions are available.
   * Errors are logged but don't crash the application.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailyUpdateCheck() {
    this.logger.log('Running scheduled update check...');

    try {
      await this.updatesService.checkForUpdates();
      this.logger.log('Scheduled update check completed successfully');
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.logger.error('Scheduled update check failed', (error as any).message);
    }
  }

  /**
   * Optional: Weekly check on Monday at 9:00 AM (for redundancy)
   *
   * Uncomment this method if you want an additional weekly check.
   */
  // @Cron('0 9 * * 1')
  // async handleWeeklyUpdateCheck() {
  //   this.logger.log('Running weekly update check...');
  //   await this.handleDailyUpdateCheck();
  // }
}
