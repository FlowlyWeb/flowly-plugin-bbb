import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Institution } from './entities/institution.entity';
import { Style } from './entities/style.entity';
import { InstitutionsController } from './institutions.controller';
import { CryptoService } from '../common/services/cypto.service';
import { InstitutionsService } from './institutions.service';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { User } from '../user/entities/user.entity';
import { EmailModule } from '../emails/email.module';
import { BbbSettings } from './entities/bbb-settings.entity';
import { BbbSettingsService } from './services/bbb-settings.service';
import { BbbSettingsController } from './controllers/bbb-settings.controller';
import { AuthModule } from '../auth/auth.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { ThemeTemplate } from '../themes/entities/theme-template.entity';

/**
 * Module for managing institutions and their configuration
 *
 * Provides:
 * - Institution CRUD operations
 * - BBB styling/customization
 * - BBB settings management
 * - Domain-based institution lookup
 *
 * This module is the source of truth for institutions in the Flowly ecosystem.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Institution, Style, User, BbbSettings, ThemeTemplate]),
    EmailModule,
    WorkspacesModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [InstitutionsController, BbbSettingsController],
  providers: [InstitutionsService, BbbSettingsService, CryptoService, RateLimitGuard],
  exports: [InstitutionsService, BbbSettingsService],
})
export class InstitutionsModule {}
