import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { LicensingService } from './licensing.service';
import { LicenseVerifierService } from './license-verifier.service';
import { CheckInService } from './check-in.service';
import { LicenseState } from './entities/license-state.entity';

/**
 * Licensing module for flowly-api (on-premise)
 *
 * Provides offline JWT license validation and periodic check-ins:
 * - Local JWT verification using embedded public key
 * - License state persistence for offline operation
 * - Scheduled check-ins with flowly-core
 * - Grace period management
 */
@Module({
  imports: [TypeOrmModule.forFeature([LicenseState]), ScheduleModule.forRoot()],
  providers: [LicensingService, LicenseVerifierService, CheckInService],
  exports: [LicensingService, LicenseVerifierService, CheckInService],
})
export class LicensingModule {}
