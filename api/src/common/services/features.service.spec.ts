import { Test, TestingModule } from '@nestjs/testing';
import { FeaturesService, FeaturesMap } from './features.service';
import { PricingTier } from '../../institutions/entities/institution.entity';

describe('FeaturesService', () => {
  let service: FeaturesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FeaturesService],
    }).compile();

    service = module.get(FeaturesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------- hasFeature ----------
  describe('hasFeature', () => {
    it('should return true for Discovery tier features at Discovery level', () => {
      expect(service.hasFeature('customizeLogo', PricingTier.DISCOVERY)).toBe(true);
      expect(service.hasFeature('basicMentionsOnly', PricingTier.DISCOVERY)).toBe(true);
    });

    it('should return false for Starter features at Discovery level', () => {
      expect(service.hasFeature('customizeColors', PricingTier.DISCOVERY)).toBe(false);
      expect(service.hasFeature('highlightModerators', PricingTier.DISCOVERY)).toBe(false);
      expect(service.hasFeature('generateYAMLConfig', PricingTier.DISCOVERY)).toBe(false);
    });

    it('should return true for Starter features at Starter level', () => {
      expect(service.hasFeature('customizeColors', PricingTier.STARTER)).toBe(true);
      expect(service.hasFeature('highlightModerators', PricingTier.STARTER)).toBe(true);
      expect(service.hasFeature('generateYAMLConfig', PricingTier.STARTER)).toBe(true);
    });

    it('should return false for Pro features at Starter level', () => {
      expect(service.hasFeature('completeTheme', PricingTier.STARTER)).toBe(false);
      expect(service.hasFeature('mentionUsers', PricingTier.STARTER)).toBe(false);
      expect(service.hasFeature('subOrganizations', PricingTier.STARTER)).toBe(false);
    });

    it('should return true for Pro features at Pro level', () => {
      expect(service.hasFeature('completeTheme', PricingTier.PRO)).toBe(true);
      expect(service.hasFeature('mentionUsers', PricingTier.PRO)).toBe(true);
      expect(service.hasFeature('realtimeModification', PricingTier.PRO)).toBe(true);
      expect(service.hasFeature('subOrganizations', PricingTier.PRO)).toBe(true);
      expect(service.hasFeature('gifModule', PricingTier.PRO)).toBe(true);
    });

    it('should return false for Enterprise features at Pro level', () => {
      expect(service.hasFeature('usernamesModule', PricingTier.PRO)).toBe(false);
    });

    it('should return true for all features at Enterprise level', () => {
      expect(service.hasFeature('customizeLogo', PricingTier.ENTERPRISE)).toBe(true);
      expect(service.hasFeature('customizeColors', PricingTier.ENTERPRISE)).toBe(true);
      expect(service.hasFeature('completeTheme', PricingTier.ENTERPRISE)).toBe(true);
      expect(service.hasFeature('usernamesModule', PricingTier.ENTERPRISE)).toBe(true);
    });

    it('should return false for unknown features', () => {
      expect(service.hasFeature('nonExistentFeature', PricingTier.ENTERPRISE)).toBe(false);
    });
  });

  // ---------- getFeaturesForTier ----------
  describe('getFeaturesForTier', () => {
    it('should return correct feature map for Discovery tier', () => {
      const features = service.getFeaturesForTier(PricingTier.DISCOVERY);

      expect(features.customizeLogo).toBe(true);
      expect(features.basicMentionsOnly).toBe(true);
      expect(features.customizeColors).toBe(false);
      expect(features.highlightModerators).toBe(false);
      expect(features.completeTheme).toBe(false);
      expect(features.usernamesModule).toBe(false);
    });

    it('should return correct feature map for Starter tier', () => {
      const features = service.getFeaturesForTier(PricingTier.STARTER);

      expect(features.customizeLogo).toBe(true);
      expect(features.customizeColors).toBe(true);
      expect(features.highlightModerators).toBe(true);
      expect(features.generateYAMLConfig).toBe(true);
      expect(features.completeTheme).toBe(false);
      expect(features.mentionUsers).toBe(false);
    });

    it('should return correct feature map for Pro tier', () => {
      const features = service.getFeaturesForTier(PricingTier.PRO);

      expect(features.completeTheme).toBe(true);
      expect(features.mentionUsers).toBe(true);
      expect(features.realtimeModification).toBe(true);
      expect(features.subOrganizations).toBe(true);
      expect(features.gifModule).toBe(true);
      expect(features.usernamesModule).toBe(false);
    });

    it('should return all features enabled for Enterprise tier', () => {
      const features = service.getFeaturesForTier(PricingTier.ENTERPRISE);

      const allEnabled = Object.values(features).every((v) => v === true);
      expect(allEnabled).toBe(true);
    });

    it('should return all keys of FeaturesMap interface', () => {
      const features = service.getFeaturesForTier(PricingTier.DISCOVERY);
      const expectedKeys: (keyof FeaturesMap)[] = [
        'customizeLogo',
        'basicMentionsOnly',
        'customizeColors',
        'highlightModerators',
        'generateYAMLConfig',
        'completeTheme',
        'mentionUsers',
        'realtimeModification',
        'subOrganizations',
        'gifModule',
        'usernamesModule',
      ];

      expect(Object.keys(features).sort()).toEqual(expectedKeys.sort());
    });
  });

  // ---------- getMinimumTierForFeature ----------
  describe('getMinimumTierForFeature', () => {
    it('should return Discovery for logo customization', () => {
      expect(service.getMinimumTierForFeature('customizeLogo')).toBe(PricingTier.DISCOVERY);
    });

    it('should return Starter for color customization', () => {
      expect(service.getMinimumTierForFeature('customizeColors')).toBe(PricingTier.STARTER);
    });

    it('should return Pro for complete theme', () => {
      expect(service.getMinimumTierForFeature('completeTheme')).toBe(PricingTier.PRO);
    });

    it('should return Enterprise for usernames module', () => {
      expect(service.getMinimumTierForFeature('usernamesModule')).toBe(PricingTier.ENTERPRISE);
    });

    it('should return null for unknown features', () => {
      expect(service.getMinimumTierForFeature('unknownFeature')).toBeNull();
    });
  });

  // ---------- getPlanName ----------
  describe('getPlanName', () => {
    it('should return French name for Discovery tier', () => {
      expect(service.getPlanName(PricingTier.DISCOVERY)).toBe('Découverte');
    });

    it('should return correct names for all tiers', () => {
      expect(service.getPlanName(PricingTier.STARTER)).toBe('Starter');
      expect(service.getPlanName(PricingTier.PRO)).toBe('Pro');
      expect(service.getPlanName(PricingTier.ENTERPRISE)).toBe('Enterprise');
    });

    it('should return the raw tier value for unknown tiers', () => {
      expect(service.getPlanName('unknown' as PricingTier)).toBe('unknown');
    });
  });

  // ---------- getAllFeatures ----------
  describe('getAllFeatures', () => {
    it('should return all feature names', () => {
      const features = service.getAllFeatures();

      expect(features).toContain('customizeLogo');
      expect(features).toContain('usernamesModule');
      expect(features.length).toBe(11);
    });
  });

  // ---------- Tier hierarchy validation ----------
  describe('tier hierarchy', () => {
    it('should ensure higher tiers always include lower tier features', () => {
      const tiers = [
        PricingTier.DISCOVERY,
        PricingTier.STARTER,
        PricingTier.PRO,
        PricingTier.ENTERPRISE,
      ];

      for (let i = 0; i < tiers.length - 1; i++) {
        const lowerFeatures = service.getFeaturesForTier(tiers[i]);
        const higherFeatures = service.getFeaturesForTier(tiers[i + 1]);

        for (const [key, value] of Object.entries(lowerFeatures)) {
          if (value) {
            expect(higherFeatures[key as keyof FeaturesMap]).toBe(true);
          }
        }
      }
    });
  });
});
