import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

import { UpdatesService } from './updates.service';
import { UpdatesController, UpdatesWebhookController } from './updates.controller';
import { UpdatesScheduler } from './updates.scheduler';

import { UpdateStatus } from './entities/update-status.entity';
import { UpdateHistory } from './entities/update-history.entity';

import { ChangelogService } from './services/changelog.service';
import { UpdateOrchestratorService } from './services/update-orchestrator.service';
import { UpdateNotificationService } from './services/update-notification.service';
import { WatchtowerClientService } from './services/watchtower-client.service';
import { DockerInspectionService } from './services/docker-inspection.service';

import { LicensingModule } from '../licensing/licensing.module';
import { EmailModule } from '../emails/email.module';

/**
 * Updates module for flowly-api
 *
 * Handles update management for both SaaS and on-premise deployments:
 *
 * SaaS Mode:
 * - Update checks via flowly-core API
 *
 * On-Premise Mode:
 * - Update detection via Watchtower API
 * - Docker image inspection for version information
 * - Changelog extraction from Docker labels
 *
 * Common Features:
 * - Update status tracking
 * - Update orchestration (backup, migrate, update, rollback)
 * - Update history
 * - Email notifications
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([UpdateStatus, UpdateHistory]),
    ScheduleModule.forRoot(),
    LicensingModule,
    EmailModule,
  ],
  controllers: [UpdatesController, UpdatesWebhookController],
  providers: [
    UpdatesService,
    UpdatesScheduler,
    ChangelogService,
    UpdateOrchestratorService,
    UpdateNotificationService,
    WatchtowerClientService,
    DockerInspectionService,
  ],
  exports: [UpdatesService, UpdateOrchestratorService],
})
export class UpdatesModule {}
