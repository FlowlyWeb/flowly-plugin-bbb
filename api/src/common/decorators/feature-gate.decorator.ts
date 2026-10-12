import { SetMetadata, UseGuards } from '@nestjs/common';
import { FEATURE_GATE_KEY, FeatureGateGuard } from '../guards/feature-gate.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

/**
 * FeatureGate decorator
 *
 * Protects routes with feature gating based on pricing tier
 * Automatically applies JwtAuthGuard before FeatureGateGuard to ensure user is authenticated
 *
 * @example
 * @FeatureGate('completeTheme')
 * @Put('bbb-settings/theme')
 * async updateTheme() { ... }
 *
 * This will only allow Pro and Enterprise tiers to access this endpoint
 */
export const FeatureGate = (feature: string) => {
  return (target: object, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    // Apply the decorator metadata
    SetMetadata(FEATURE_GATE_KEY, feature)(target, propertyKey!, descriptor!);

    // Apply BOTH guards in the correct order: JWT first, then FeatureGate
    // This ensures request.user is populated before FeatureGateGuard checks institutionId
    UseGuards(JwtAuthGuard, FeatureGateGuard)(target, propertyKey!, descriptor!);
  };
};
