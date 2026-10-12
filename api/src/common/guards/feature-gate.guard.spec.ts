import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { FeatureGateGuard } from './feature-gate.guard';
import { InstitutionsService } from '../../institutions/institutions.service';
import { FeaturesService } from '../services/features.service';
import { PricingTier } from '../../institutions/entities/institution.entity';

function createMockExecutionContext(
  overrides: {
    user?: { institutionId?: string };
  } = {},
): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({
        user: overrides.user ?? { institutionId: 'inst-1' },
      }),
    }),
    getType: jest.fn(),
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToWs: jest.fn(),
  } as unknown as ExecutionContext;
}

describe('FeatureGateGuard', () => {
  let guard: FeatureGateGuard;
  let reflector: jest.Mocked<Reflector>;
  let institutionsService: jest.Mocked<InstitutionsService>;
  let configService: jest.Mocked<ConfigService>;
  let featuresService: jest.Mocked<FeaturesService>;

  beforeEach(async () => {
    reflector = {
      get: jest.fn(),
      getAllAndOverride: jest.fn(),
      getAll: jest.fn(),
      getAllAndMerge: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureGateGuard,
        { provide: Reflector, useValue: reflector },
        {
          provide: InstitutionsService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('saas'),
          },
        },
        {
          provide: FeaturesService,
          useValue: {
            hasFeature: jest.fn(),
            getPlanName: jest.fn(),
            getMinimumTierForFeature: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get(FeatureGateGuard);
    institutionsService = module.get(InstitutionsService);
    configService = module.get(ConfigService);
    featuresService = module.get(FeaturesService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow access when no feature gate is specified', async () => {
      reflector.get.mockReturnValue(undefined);
      const context = createMockExecutionContext();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow access in on-premise mode regardless of feature', async () => {
      reflector.get.mockReturnValue('completeTheme');
      configService.get.mockReturnValue('onpremise');
      const context = createMockExecutionContext();

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      // Should not even check institution or features
      expect(institutionsService.findById).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when no institutionId in request', async () => {
      reflector.get.mockReturnValue('completeTheme');
      configService.get.mockReturnValue('saas');
      const context = createMockExecutionContext({ user: {} });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Institution not found in request');
    });

    it('should throw ForbiddenException when institution not found', async () => {
      reflector.get.mockReturnValue('completeTheme');
      configService.get.mockReturnValue('saas');
      institutionsService.findById.mockResolvedValue(null);
      const context = createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Institution not found');
    });

    it('should allow access when institution has the required feature', async () => {
      reflector.get.mockReturnValue('customizeColors');
      configService.get.mockReturnValue('saas');
      institutionsService.findById.mockResolvedValue({
        id: 'inst-1',
        currentPricingTier: PricingTier.STARTER,
      } as any);
      featuresService.hasFeature.mockReturnValue(true);

      const context = createMockExecutionContext();
      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(featuresService.hasFeature).toHaveBeenCalledWith(
        'customizeColors',
        PricingTier.STARTER,
      );
    });

    it('should attach featureInfo to request when access is granted', async () => {
      reflector.get.mockReturnValue('customizeColors');
      configService.get.mockReturnValue('saas');
      institutionsService.findById.mockResolvedValue({
        id: 'inst-1',
        currentPricingTier: PricingTier.STARTER,
      } as any);
      featuresService.hasFeature.mockReturnValue(true);

      const mockRequest = { user: { institutionId: 'inst-1' } } as any;
      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      await guard.canActivate(context);

      expect(mockRequest.featureInfo).toEqual({
        feature: 'customizeColors',
        tier: PricingTier.STARTER,
        hasAccess: true,
      });
    });

    it('should throw ForbiddenException with descriptive message when feature not available', async () => {
      reflector.get.mockReturnValue('completeTheme');
      configService.get.mockReturnValue('saas');
      institutionsService.findById.mockResolvedValue({
        id: 'inst-1',
        currentPricingTier: PricingTier.STARTER,
      } as any);
      featuresService.hasFeature.mockReturnValue(false);
      featuresService.getPlanName.mockReturnValue('Starter');
      featuresService.getMinimumTierForFeature.mockReturnValue(PricingTier.PRO);

      const context = createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow(
        'Feature "completeTheme" is not available in Starter plan',
      );
    });

    it('should use Enterprise as fallback when minimum tier is null', async () => {
      reflector.get.mockReturnValue('unknownFeature');
      configService.get.mockReturnValue('saas');
      institutionsService.findById.mockResolvedValue({
        id: 'inst-1',
        currentPricingTier: PricingTier.DISCOVERY,
      } as any);
      featuresService.hasFeature.mockReturnValue(false);
      featuresService.getPlanName.mockReturnValue('Découverte');
      featuresService.getMinimumTierForFeature.mockReturnValue(null);

      const context = createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(/Minimum required: Enterprise/);
    });

    it('should throw generic ForbiddenException on unexpected errors', async () => {
      reflector.get.mockReturnValue('completeTheme');
      configService.get.mockReturnValue('saas');
      institutionsService.findById.mockRejectedValue(new Error('DB connection failed'));

      const context = createMockExecutionContext();

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow('Failed to check feature access');
    });

    // Tier-based access matrix tests
    describe('tier-based access matrix', () => {
      const testCases = [
        { feature: 'customizeLogo', tier: PricingTier.DISCOVERY, expected: true },
        { feature: 'customizeColors', tier: PricingTier.DISCOVERY, expected: false },
        { feature: 'customizeColors', tier: PricingTier.STARTER, expected: true },
        { feature: 'completeTheme', tier: PricingTier.STARTER, expected: false },
        { feature: 'completeTheme', tier: PricingTier.PRO, expected: true },
        { feature: 'usernamesModule', tier: PricingTier.PRO, expected: false },
        { feature: 'usernamesModule', tier: PricingTier.ENTERPRISE, expected: true },
      ];

      testCases.forEach(({ feature, tier, expected }) => {
        it(`should ${expected ? 'allow' : 'deny'} "${feature}" for ${tier} tier`, async () => {
          reflector.get.mockReturnValue(feature);
          configService.get.mockReturnValue('saas');
          institutionsService.findById.mockResolvedValue({
            id: 'inst-1',
            currentPricingTier: tier,
          } as any);
          featuresService.hasFeature.mockReturnValue(expected);

          if (!expected) {
            featuresService.getPlanName.mockReturnValue(tier);
            featuresService.getMinimumTierForFeature.mockReturnValue(PricingTier.PRO);
          }

          const context = createMockExecutionContext();

          if (expected) {
            const result = await guard.canActivate(context);
            expect(result).toBe(true);
          } else {
            await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
          }
        });
      });
    });
  });
});
