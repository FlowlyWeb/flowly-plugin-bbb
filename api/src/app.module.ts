import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { getDatabaseConfig } from './config/database.config';
import { DynamicOriginsCacheService } from './common/services/dynamic-origins-cache.service';
import { OriginsUpdateListener } from './common/listeners/origins-update.listener';
import { LastSeenInterceptor } from './common/interceptors/last-seen.interceptor';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { InstitutionsModule } from './institutions/institutions.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { UserModule } from './user/user.module';
import { ServersModule } from './servers/servers.module';
import { EmailModule } from './emails/email.module';
import { HealthModule } from './health/health.module';
import { LicensingModule } from './licensing/licensing.module';
import { UpdatesModule } from './updates/updates.module';
import { ThemesModule } from './themes/themes.module';

/**
 * Root application module for Flowly API (Application Layer)
 *
 * This API handles:
 * - Institution management (source of truth)
 * - User authentication and management
 * - BBB server tracking
 * - Styles and customization
 * - License validation (on-premise)
 * - Update checks (on-premise)
 *
 * Business logic (billing, analytics, global admin) is handled by flowly-core.
 * API documentation is provided via Swagger.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      envFilePath: [
        `.env.${process.env.NODE_ENV || 'development'}`,
        '.env', // Fallback to .env if NODE_ENV specific file doesn't exist
      ],
      expandVariables: true,
      cache: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    EventEmitterModule.forRoot(),
    CommonModule,
    AuthModule,
    InstitutionsModule,
    WorkspacesModule,
    UserModule,
    ServersModule,
    EmailModule,
    HealthModule,
    LicensingModule,
    UpdatesModule,
    ThemesModule,
  ],
  providers: [DynamicOriginsCacheService, OriginsUpdateListener, LastSeenInterceptor],
})
export class AppModule {}
