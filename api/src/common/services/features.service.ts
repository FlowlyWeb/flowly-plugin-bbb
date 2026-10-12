import { Injectable } from '@nestjs/common';
import { PricingTier } from '../../institutions/entities/institution.entity';

/**
 * Features map interface
 * Maps feature names to boolean values
 */
export interface FeaturesMap {
  customizeLogo: boolean;
  basicMentionsOnly: boolean;
  customizeColors: boolean;
  highlightModerators: boolean;
  generateYAMLConfig: boolean;
  completeTheme: boolean;
  mentionUsers: boolean;
  realtimeModification: boolean;
  subOrganizations: boolean;
  gifModule: boolean;
  usernamesModule: boolean;
}

/**
 * FeaturesService
 *
 * Centralized service for managing feature access control across pricing tiers.
 * This is the single source of truth for feature availability.
 *
 * In the future, this could be replaced by fetching features from a database table
 * synchronized with flowly-core pricing plans.
 */
@Injectable()
export class FeaturesService {
  /**
   * Feature access control matrix
   * Maps feature names to the tiers that have access to them
   *
   * TODO: In a future iteration, this could be replaced by:
   * - A pricing_plans table in flowly-api database
   * - An API call to flowly-core to fetch features
   * - A cached sync mechanism between flowly-core and flowly-api
   */
  private readonly featureMatrix: Record<string, PricingTier[]> = {
    // Discovery tier features (all tiers)
    customizeLogo: [
      PricingTier.DISCOVERY,
      PricingTier.STARTER,
      PricingTier.PRO,
      PricingTier.ENTERPRISE,
    ],
    basicMentionsOnly: [
      PricingTier.DISCOVERY,
      PricingTier.STARTER,
      PricingTier.PRO,
      PricingTier.ENTERPRISE,
    ],

    // Starter tier features (starter+)
    customizeColors: [PricingTier.STARTER, PricingTier.PRO, PricingTier.ENTERPRISE],
    highlightModerators: [PricingTier.STARTER, PricingTier.PRO, PricingTier.ENTERPRISE],
    generateYAMLConfig: [PricingTier.STARTER, PricingTier.PRO, PricingTier.ENTERPRISE],

    // Pro tier features (pro+)
    completeTheme: [PricingTier.PRO, PricingTier.ENTERPRISE],
    mentionUsers: [PricingTier.PRO, PricingTier.ENTERPRISE],
    realtimeModification: [PricingTier.PRO, PricingTier.ENTERPRISE],
    subOrganizations: [PricingTier.PRO, PricingTier.ENTERPRISE],
    gifModule: [PricingTier.PRO, PricingTier.ENTERPRISE],

    // Enterprise tier features
    usernamesModule: [PricingTier.ENTERPRISE],
  };

  /**
   * Check if a specific feature is available for a given pricing tier
   *
   * @param feature - Feature name to check
   * @param tier - Pricing tier to check against
   * @returns True if the feature is available for the tier
   */
  hasFeature(feature: string, tier: PricingTier): boolean {
    const allowedTiers = this.featureMatrix[feature] || [];
    return allowedTiers.includes(tier);
  }

  /**
   * Get all features for a specific pricing tier
   *
   * @param tier - Pricing tier
   * @returns Map of feature names to their availability (boolean)
   */
  getFeaturesForTier(tier: PricingTier): FeaturesMap {
    return {
      customizeLogo: this.hasFeature('customizeLogo', tier),
      basicMentionsOnly: this.hasFeature('basicMentionsOnly', tier),
      customizeColors: this.hasFeature('customizeColors', tier),
      highlightModerators: this.hasFeature('highlightModerators', tier),
      generateYAMLConfig: this.hasFeature('generateYAMLConfig', tier),
      completeTheme: this.hasFeature('completeTheme', tier),
      mentionUsers: this.hasFeature('mentionUsers', tier),
      realtimeModification: this.hasFeature('realtimeModification', tier),
      subOrganizations: this.hasFeature('subOrganizations', tier),
      gifModule: this.hasFeature('gifModule', tier),
      usernamesModule: this.hasFeature('usernamesModule', tier),
    };
  }

  /**
   * Get the minimum required tier for a specific feature
   *
   * @param feature - Feature name
   * @returns Minimum pricing tier required (or null if feature doesn't exist)
   */
  getMinimumTierForFeature(feature: string): PricingTier | null {
    const allowedTiers = this.featureMatrix[feature];
    if (!allowedTiers || allowedTiers.length === 0) {
      return null;
    }

    // Tiers are ordered from lowest to highest
    const tierOrder = [
      PricingTier.DISCOVERY,
      PricingTier.STARTER,
      PricingTier.PRO,
      PricingTier.ENTERPRISE,
    ];

    for (const tier of tierOrder) {
      if (allowedTiers.includes(tier)) {
        return tier;
      }
    }

    return null;
  }

  /**
   * Get human-readable plan name for a pricing tier
   *
   * @param tier - Pricing tier
   * @returns Human-readable plan name
   */
  getPlanName(tier: PricingTier): string {
    const names: Record<PricingTier, string> = {
      [PricingTier.DISCOVERY]: 'Découverte',
      [PricingTier.STARTER]: 'Starter',
      [PricingTier.PRO]: 'Pro',
      [PricingTier.ENTERPRISE]: 'Enterprise',
    };
    return names[tier] || tier;
  }

  /**
   * Get all available features (feature matrix keys)
   *
   * @returns Array of all feature names
   */
  getAllFeatures(): string[] {
    return Object.keys(this.featureMatrix);
  }
}
