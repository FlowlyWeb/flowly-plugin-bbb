import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServersController } from './servers.controller';
import { ServersService } from './servers.service';
import { ActiveServer } from './entities/active-server.entity';
import { ScheduleModule } from '@nestjs/schedule';
import { InstitutionsModule } from '../institutions/institutions.module';

/**
 * Module for managing active BigBlueButton servers
 *
 * Tracks server heartbeats and provides endpoints to:
 * - Receive heartbeat signals from BBB servers
 * - List active servers for an institution
 * - Reset server status
 */
@Module({
  imports: [TypeOrmModule.forFeature([ActiveServer]), ScheduleModule.forRoot(), InstitutionsModule],
  controllers: [ServersController],
  providers: [ServersService],
  exports: [ServersService],
})
export class ServersModule {}
