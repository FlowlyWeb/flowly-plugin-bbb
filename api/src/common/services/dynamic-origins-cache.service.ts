import { Injectable } from '@nestjs/common';
import { InstitutionsService } from '../../institutions/institutions.service';
import { ConfigService } from '@nestjs/config';
import * as process from 'node:process';
import { DeploymentConfig } from '../../config/deployment.config';

@Injectable()
export class DynamicOriginsCacheService {
  private cachedOrigins: string[] = [];
  private lastUpdateTimestamp: number = 0;
  private CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

  constructor(
    private institutionService: InstitutionsService,
    private configService: ConfigService,
  ) {}

  async getAllowedOrigins(): Promise<string[]> {
    const now = Date.now();
    const isDevelopment = this.configService.get('NODE_ENV') === 'development';
    const isOnPremise = DeploymentConfig.isOnPremise;

    const shouldRefresh = isDevelopment
      ? now - this.lastUpdateTimestamp > 60 * 1000 // 1 minute en dev
      : now - this.lastUpdateTimestamp > this.CACHE_DURATION;

    if (this.cachedOrigins.length === 0 || shouldRefresh) {
      await this.refreshOrigins();
    }

    // eslint-disable-next-line no-console
    console.log(process.env.FRONTEND_URL);

    const baseOrigins = [
      ...this.cachedOrigins,
      process.env.FRONTEND_URL || 'http://localhost:3000',
    ];
    // Ajouter localhost:3002 pour flowly-docs et localhost:3001 pour flowly-dashboard en mode développement
    if (isDevelopment) {
      baseOrigins.push(
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002',
      );
    }

    // Ajouter les origines de dev supplémentaires (en dev ET on-premise)
    if (isDevelopment || isOnPremise) {
      const additionalDevOrigins =
        process.env.ALLOWED_DEV_ORIGINS?.split(',').map((o) => o.trim()) || [];
      baseOrigins.push(...additionalDevOrigins);
    }

    return baseOrigins;
  }

  async refreshOrigins(): Promise<void> {
    const domains = await this.institutionService.findAllActiveDomains();

    this.cachedOrigins = domains.flatMap((domain) => {
      const variants = [`https://${domain}`, `https://www.${domain}`, `https://*.${domain}`];

      if (this.configService.get('NODE_ENV') === 'development') {
        variants.push(`http://${domain}`, `http://www.${domain}`, `http://*.${domain}`);
      }

      return variants;
    });

    this.lastUpdateTimestamp = Date.now();
  }
}
