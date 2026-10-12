import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThemeTemplate } from './entities/theme-template.entity';
import { Style } from '../institutions/entities/style.entity';
import { Institution } from '../institutions/entities/institution.entity';
import { Workspace } from '../institutions/entities/workspace.entity';
import { User } from '../user/entities/user.entity';
import { InstitutionsModule } from '../institutions/institutions.module';
import { ThemesService } from './themes.service';
import { ThemesController } from './themes.controller';

/**
 * Module for the Theme Library feature.
 *
 * Provides browse, apply, export, and import functionality
 * for predefined theme templates. Gated by the `completeTheme`
 * feature flag (Pro tier or higher).
 *
 * Imports InstitutionsModule to satisfy FeatureGateGuard dependency
 * on InstitutionsService.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ThemeTemplate, Style, Institution, Workspace, User]),
    InstitutionsModule,
  ],
  controllers: [ThemesController],
  providers: [ThemesService],
  exports: [ThemesService],
})
export class ThemesModule {}
