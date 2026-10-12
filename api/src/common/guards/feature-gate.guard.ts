import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { InstitutionsService } from '../../institutions/institutions.service';
import { FeaturesService } from '../services/features.service';

/**
 * Feature gate metadata key
 * Usage: @FeatureGate('completeTheme')
 */
export const FEATURE_GATE_KEY = 'featureGate';

/**
 * FeatureGateGuard
 *
 * Enforces feature access control based on pricing tier
 * Used to restrict certain features to specific plans
 */
@Injectable()
export class FeatureGateGuard implements CanActivate {
  private readonly logger = new Logger(FeatureGateGuard.name);

  constructor(
    private reflector: Reflector,
    private institutionsService: InstitutionsService,
    private configService: ConfigService,
    private featuresService: FeaturesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get the feature requirement from decorator metadata
    const requiredFeature = this.reflector.get<string>(FEATURE_GATE_KEY, context.getHandler());

    // If no feature gate is specified, allow access
    if (!requiredFeature) {
      return true;
    }

    // On-premise mode bypasses all feature checks (full access)
    const deploymentMode = this.configService.get<string>('deploymentMode', 'saas');
    if (deploymentMode === 'onpremise') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const institutionId = request.user?.institutionId;

    if (!institutionId) {
      throw new ForbiddenException('Institution not found in request');
    }

    try {
      const institution = await this.institutionsService.findById(institutionId);

      if (!institution) {
        throw new ForbiddenException('Institution not found');
      }

      // Check if feature is available for this tier using FeaturesService
      const hasAccess = this.featuresService.hasFeature(
        requiredFeature,
        institution.currentPricingTier,
      );

      if (!hasAccess) {
        const tierName = this.featuresService.getPlanName(institution.currentPricingTier);
        const minTier = this.featuresService.getMinimumTierForFeature(requiredFeature);
        const minTierName = minTier ? this.featuresService.getPlanName(minTier) : 'Enterprise';

        throw new ForbiddenException(
          `Feature "${requiredFeature}" is not available in ${tierName} plan. Minimum required: ${minTierName}`,
        );
      }

      // Attach feature info to request
      request.featureInfo = {
        feature: requiredFeature,
        tier: institution.currentPricingTier,
        hasAccess: true,
      };

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      this.logger.error(`Error checking feature access: ${err.message}`, err.stack);
      throw new ForbiddenException('Failed to check feature access');
    }
  }
}
