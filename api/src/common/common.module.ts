import { Global, Module } from '@nestjs/common';
import { FeaturesService } from './services/features.service';

/**
 * CommonModule
 *
 * Global module providing shared services across the application.
 * Marked as @Global() so services are available everywhere without explicit imports.
 */
@Global()
@Module({
  providers: [FeaturesService],
  exports: [FeaturesService],
})
export class CommonModule {}
