import { ApiProperty } from '@nestjs/swagger';
import { PricingTier } from '../entities/institution.entity';

/**
 * Features interface matching pricing plan feature flags
 */
export interface Features {
  mentionUsers: boolean;
  completeTheme: boolean;
  customizeLogo: boolean;
  customizeColors: boolean;
  basicMentionsOnly: boolean;
  generateYAMLConfig: boolean;
  highlightModerators: boolean;
  realtimeModification: boolean;
  subOrganizations: boolean;
}

/**
 * Quota usage information
 */
export class QuotaUsage {
  @ApiProperty({ example: 1, description: 'Number of resources currently used' })
  used: number;

  @ApiProperty({ example: 2, description: 'Maximum allowed resources for current plan' })
  limit: number;

  @ApiProperty({ example: false, description: 'Whether the limit has been reached' })
  isLimitReached: boolean;
}

/**
 * Response DTO for institution features endpoint
 * Returns pricing tier, quotas, and feature flags for the authenticated institution
 */
export class InstitutionFeaturesDto {
  @ApiProperty({
    enum: PricingTier,
    example: PricingTier.PRO,
    description: 'Current pricing tier of the institution',
  })
  tier: PricingTier;

  @ApiProperty({
    example: 'Pro',
    description: 'Human-readable name of the current plan',
  })
  planName: string;

  @ApiProperty({
    description: 'Server quota usage',
    type: QuotaUsage,
  })
  quotaServers: QuotaUsage;

  @ApiProperty({
    description: 'Sub-organizations quota usage',
    type: QuotaUsage,
  })
  quotaSubOrgs: QuotaUsage;

  @ApiProperty({
    description: 'Feature flags available for the current pricing tier',
    example: {
      mentionUsers: true,
      completeTheme: true,
      customizeLogo: true,
      customizeColors: true,
      basicMentionsOnly: false,
      generateYAMLConfig: true,
      highlightModerators: true,
      realtimeModification: true,
      subOrganizations: true,
    },
  })
  features: Features;

  @ApiProperty({
    example: 'saas',
    enum: ['saas', 'onpremise'],
    description: 'Deployment mode (saas requires feature checks, onpremise bypasses)',
  })
  deploymentMode: string;
}
