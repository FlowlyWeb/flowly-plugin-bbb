import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { InstitutionsService } from './institutions.service';
import { Institution, PricingTier } from './entities/institution.entity';
import { Style } from './entities/style.entity';
import { User } from '../user/entities/user.entity';
import { ThemeTemplate } from '../themes/entities/theme-template.entity';
import { BbbSettingsService } from './services/bbb-settings.service';
import { FeaturesService } from '../common/services/features.service';

// Helper to build a fake institution
function buildInstitution(overrides: Partial<Institution> = {}): Institution {
  return {
    id: 'inst-1',
    domain: 'example.com',
    name: 'Test Institution',
    geoRegion: 'france',
    address: '123 Street',
    vatNumber: null as unknown as string,
    isActive: true,
    licenseKey: null as unknown as string,
    licenseCachedAt: null as unknown as Date,
    licenseCachedData: null as unknown as Institution['licenseCachedData'],
    currentPricingTier: PricingTier.STARTER,
    quotaServersUsed: 2,
    quotaServerLimit: 5,
    quotaSubOrgsUsed: 1,
    quotaSubOrgLimit: 3,
    defaultStyle: { id: 'style-1' } as Style,
    workspaces: [],
    users: [],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    ...overrides,
  } as Institution;
}

describe('InstitutionsService', () => {
  let service: InstitutionsService;
  let institutionsRepo: jest.Mocked<Repository<Institution>>;
  let stylesRepo: jest.Mocked<Repository<Style>>;
  let _userRepo: jest.Mocked<Repository<User>>;
  let _themeTemplateRepo: jest.Mocked<Repository<ThemeTemplate>>;
  let bbbSettingsService: jest.Mocked<BbbSettingsService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let configService: jest.Mocked<ConfigService>;
  let featuresService: jest.Mocked<FeaturesService>;

  beforeEach(async () => {
    const mockRepo = () => ({
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InstitutionsService,
        { provide: getRepositoryToken(Institution), useFactory: mockRepo },
        { provide: getRepositoryToken(Style), useFactory: mockRepo },
        { provide: getRepositoryToken(User), useFactory: mockRepo },
        { provide: getRepositoryToken(ThemeTemplate), useFactory: mockRepo },
        {
          provide: BbbSettingsService,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('saas') },
        },
        {
          provide: FeaturesService,
          useValue: {
            getFeaturesForTier: jest.fn().mockReturnValue({
              customizeLogo: true,
              basicMentionsOnly: true,
              customizeColors: true,
              highlightModerators: true,
              generateYAMLConfig: true,
              completeTheme: false,
              mentionUsers: false,
              realtimeModification: false,
              subOrganizations: false,
            }),
            getPlanName: jest.fn().mockReturnValue('Starter'),
          },
        },
      ],
    }).compile();

    service = module.get(InstitutionsService);
    institutionsRepo = module.get(getRepositoryToken(Institution));
    stylesRepo = module.get(getRepositoryToken(Style));
    _userRepo = module.get(getRepositoryToken(User));
    _themeTemplateRepo = module.get(getRepositoryToken(ThemeTemplate));
    bbbSettingsService = module.get(BbbSettingsService);
    eventEmitter = module.get(EventEmitter2);
    configService = module.get(ConfigService);
    featuresService = module.get(FeaturesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------- findById ----------
  describe('findById', () => {
    it('should return an institution when found', async () => {
      const inst = buildInstitution();
      institutionsRepo.findOne.mockResolvedValue(inst);

      const result = await service.findById('inst-1');

      expect(result).toEqual(inst);
      expect(institutionsRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'inst-1', isActive: true },
        relations: ['defaultStyle'],
      });
    });

    it('should return null when institution not found', async () => {
      institutionsRepo.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ---------- findAll ----------
  describe('findAll', () => {
    it('should return all institutions ordered by createdAt DESC', async () => {
      const institutions = [buildInstitution(), buildInstitution({ id: 'inst-2' })];
      institutionsRepo.find.mockResolvedValue(institutions);

      const result = await service.findAll();

      expect(result).toEqual(institutions);
      expect(institutionsRepo.find).toHaveBeenCalledWith({
        relations: ['defaultStyle'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  // ---------- findAllActiveDomains ----------
  describe('findAllActiveDomains', () => {
    it('should return active institution domains', async () => {
      institutionsRepo.find.mockResolvedValue([
        { domain: 'a.com' } as Institution,
        { domain: 'b.com' } as Institution,
      ]);

      const result = await service.findAllActiveDomains();

      expect(result).toEqual(['a.com', 'b.com']);
      expect(institutionsRepo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        select: ['domain'],
      });
    });
  });

  // ---------- create ----------
  describe('create', () => {
    it('should create institution with default styles and emit event', async () => {
      const savedStyle = { id: 'style-new' } as Style;
      const savedInst = buildInstitution({ id: 'inst-new' });

      stylesRepo.create.mockReturnValue(savedStyle);
      stylesRepo.save.mockResolvedValue(savedStyle);
      institutionsRepo.create.mockReturnValue(savedInst);
      institutionsRepo.save.mockResolvedValue(savedInst);

      const dto = { name: 'New Inst', domain: 'new.com', address: '456 Ave', geoRegion: 'eu' };
      const result = await service.create(dto as any);

      expect(result).toEqual(savedInst);
      expect(stylesRepo.create).toHaveBeenCalled();
      expect(stylesRepo.save).toHaveBeenCalledWith(savedStyle);
      expect(institutionsRepo.save).toHaveBeenCalled();
      expect(bbbSettingsService.create).toHaveBeenCalledWith('inst-new', {});
      expect(eventEmitter.emit).toHaveBeenCalledWith('institution.created', savedInst);
    });

    it('should not throw if bbb settings creation fails', async () => {
      const savedStyle = { id: 'style-new' } as Style;
      const savedInst = buildInstitution({ id: 'inst-new' });

      stylesRepo.create.mockReturnValue(savedStyle);
      stylesRepo.save.mockResolvedValue(savedStyle);
      institutionsRepo.create.mockReturnValue(savedInst);
      institutionsRepo.save.mockResolvedValue(savedInst);
      bbbSettingsService.create.mockRejectedValue(new Error('BBB init fail'));

      const dto = { name: 'New Inst', domain: 'new.com', address: '456 Ave', geoRegion: 'eu' };

      await expect(service.create(dto as any)).resolves.toEqual(savedInst);
    });
  });

  // ---------- update ----------
  describe('update', () => {
    it('should update provided fields and emit event', async () => {
      const inst = buildInstitution();
      institutionsRepo.findOne.mockResolvedValue(inst);
      institutionsRepo.save.mockResolvedValue({ ...inst, name: 'Updated' } as Institution);

      const result = await service.update('inst-1', { name: 'Updated' } as any);

      expect(result.name).toBe('Updated');
      expect(eventEmitter.emit).toHaveBeenCalledWith('institution.updated', {
        institutionId: 'inst-1',
        changes: { name: 'Updated' },
      });
    });

    it('should throw NotFoundException when institution does not exist', async () => {
      institutionsRepo.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent', {} as any)).rejects.toThrow(NotFoundException);
    });

    it('should update pricing tier and quota fields', async () => {
      const inst = buildInstitution();
      institutionsRepo.findOne.mockResolvedValue(inst);
      institutionsRepo.save.mockImplementation(async (entity) => entity as Institution);

      const dto = {
        currentPricingTier: PricingTier.PRO,
        quotaServerLimit: 10,
        quotaSubOrgLimit: 5,
      };

      const result = await service.update('inst-1', dto as any);

      expect(result.currentPricingTier).toBe(PricingTier.PRO);
      expect(result.quotaServerLimit).toBe(10);
      expect(result.quotaSubOrgLimit).toBe(5);
    });
  });

  // ---------- remove ----------
  describe('remove', () => {
    it('should remove institution and emit event', async () => {
      const inst = buildInstitution();
      institutionsRepo.findOne.mockResolvedValue(inst);
      institutionsRepo.remove.mockResolvedValue(inst);

      await service.remove('inst-1');

      expect(institutionsRepo.remove).toHaveBeenCalledWith(inst);
      expect(eventEmitter.emit).toHaveBeenCalledWith('institution.deleted', {
        institutionId: 'inst-1',
        institutionName: 'Test Institution',
      });
    });

    it('should throw NotFoundException when institution does not exist', async () => {
      institutionsRepo.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------- findByOrigin ----------
  describe('findByOrigin', () => {
    it('should match full hostname', async () => {
      const inst = buildInstitution();
      institutionsRepo.findOne.mockResolvedValue(inst);

      const result = await service.findByOrigin('https://example.com');

      expect(result).toEqual(inst);
    });

    it('should strip www prefix and port', async () => {
      const inst = buildInstitution();
      institutionsRepo.findOne.mockResolvedValue(inst);

      await service.findByOrigin('https://www.example.com:3000');

      expect(institutionsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ domain: 'example.com' }),
        }),
      );
    });

    it('should try subdomain combinations and return null if none match', async () => {
      institutionsRepo.findOne.mockResolvedValue(null);

      const result = await service.findByOrigin('https://sub.domain.example.com');

      expect(result).toBeNull();
      // Should have tried: sub.domain.example.com, domain.example.com, example.com
      expect(institutionsRepo.findOne).toHaveBeenCalledTimes(3);
    });
  });

  // ---------- findByDomain ----------
  describe('findByDomain', () => {
    it('should return institution with admin email', async () => {
      const user1 = { email: 'admin@test.com', isActive: true, createdAt: new Date() } as User;
      const inst = buildInstitution({ users: [user1] });
      institutionsRepo.findOne.mockResolvedValue(inst);

      const result = await service.findByDomain('example.com');

      expect(result).toBeDefined();
      expect(result!.adminEmail).toBe('admin@test.com');
    });

    it('should return null when domain not found', async () => {
      institutionsRepo.findOne.mockResolvedValue(null);

      const result = await service.findByDomain('unknown.com');

      expect(result).toBeNull();
    });
  });

  // ---------- updateLogo ----------
  describe('updateLogo', () => {
    it('should update logo and preserve other company settings', async () => {
      const inst = buildInstitution();
      institutionsRepo.findOne.mockResolvedValue(inst);
      const currentStyle = {
        id: 'style-1',
        company: {
          primaryColor: '#000',
          background: { type: 'solid', color: '#fff' },
          logo: null,
          favicon: null,
        },
      } as unknown as Style;
      stylesRepo.findOne
        .mockResolvedValueOnce(currentStyle) // findOne for current style
        .mockResolvedValueOnce({
          ...currentStyle,
          company: { ...currentStyle.company, logo: 'new-logo.png' },
        } as any);

      const _result = await service.updateLogo('inst-1', { logo: 'new-logo.png' } as any);

      expect(stylesRepo.update).toHaveBeenCalledWith('style-1', {
        company: expect.objectContaining({ logo: 'new-logo.png' }),
      });
    });

    it('should throw UnauthorizedException when institution not found', async () => {
      institutionsRepo.findOne.mockResolvedValue(null);

      await expect(service.updateLogo('non-existent', { logo: 'x' } as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ---------- resetStyles ----------
  describe('resetStyles', () => {
    it('should reset to default values and clear theme template link', async () => {
      const inst = buildInstitution();
      institutionsRepo.findOne.mockResolvedValue(inst);
      stylesRepo.findOne.mockResolvedValue({ id: 'style-1' } as any);

      await service.resetStyles('inst-1');

      expect(stylesRepo.update).toHaveBeenCalledWith(
        'style-1',
        expect.objectContaining({
          appliedThemeTemplateId: null,
          company: expect.objectContaining({ primaryColor: '#0F70D7' }),
        }),
      );
    });

    it('should throw UnauthorizedException when institution not found', async () => {
      institutionsRepo.findOne.mockResolvedValue(null);

      await expect(service.resetStyles('non-existent')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ---------- unlinkTheme ----------
  describe('unlinkTheme', () => {
    it('should clear appliedThemeTemplateId', async () => {
      const inst = buildInstitution();
      institutionsRepo.findOne.mockResolvedValue(inst);
      stylesRepo.findOne.mockResolvedValue({ id: 'style-1' } as any);

      await service.unlinkTheme('inst-1');

      expect(stylesRepo.update).toHaveBeenCalledWith('style-1', {
        appliedThemeTemplateId: null,
      });
    });

    it('should throw NotFoundException when institution not found', async () => {
      institutionsRepo.findOne.mockResolvedValue(null);

      await expect(service.unlinkTheme('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------- getFeaturesForInstitution ----------
  describe('getFeaturesForInstitution', () => {
    it('should return features based on pricing tier in SaaS mode', async () => {
      const inst = buildInstitution({ currentPricingTier: PricingTier.STARTER });
      institutionsRepo.findOne.mockResolvedValue(inst);
      configService.get.mockReturnValue('saas');

      const result = await service.getFeaturesForInstitution('inst-1');

      expect(result.tier).toBe(PricingTier.STARTER);
      expect(result.planName).toBe('Starter');
      expect(result.deploymentMode).toBe('saas');
      expect(featuresService.getFeaturesForTier).toHaveBeenCalledWith(PricingTier.STARTER);
    });

    it('should enable all features in on-premise mode', async () => {
      const inst = buildInstitution({ currentPricingTier: PricingTier.DISCOVERY });
      institutionsRepo.findOne.mockResolvedValue(inst);
      configService.get.mockReturnValue('onpremise');

      const result = await service.getFeaturesForInstitution('inst-1');

      expect(result.features.completeTheme).toBe(true);
      expect(result.features.mentionUsers).toBe(true);
      expect(result.features.subOrganizations).toBe(true);
      expect(result.quotaServers.limit).toBe(999999);
      expect(result.quotaServers.isLimitReached).toBe(false);
    });

    it('should throw NotFoundException when institution not found', async () => {
      institutionsRepo.findOne.mockResolvedValue(null);

      await expect(service.getFeaturesForInstitution('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should detect when quota limit is reached in SaaS mode', async () => {
      const inst = buildInstitution({
        quotaServersUsed: 5,
        quotaServerLimit: 5,
        quotaSubOrgsUsed: 3,
        quotaSubOrgLimit: 3,
      });
      institutionsRepo.findOne.mockResolvedValue(inst);
      configService.get.mockReturnValue('saas');

      const result = await service.getFeaturesForInstitution('inst-1');

      expect(result.quotaServers.isLimitReached).toBe(true);
      expect(result.quotaSubOrgs.isLimitReached).toBe(true);
    });
  });

  // ---------- getAllStyles ----------
  describe('getAllStyles', () => {
    it('should return mapped styles for all active institutions', async () => {
      const inst = buildInstitution({
        defaultStyle: {
          id: 'style-1',
          company: {
            primaryColor: '#000',
            background: { type: 'solid', color: '#fff' },
            logo: null,
            favicon: null,
          },
          questions: {
            mainColor: '#FF9800',
            backgroundColor: '#FFF3E0',
            badge: { iconName: 'question', color: '#FF9800' },
            keyword: '@question',
            isEnabled: true,
          },
          mentions: { mainColor: '#2196F3', backgroundColor: '#E3F2FD', isEnabled: true },
          moderator: {
            mainColor: '#F44336',
            backgroundColor: '#F443361A',
            badge: { iconName: 'shield', color: '#F44336' },
            isEnabled: true,
          },
          gif: { isEnabled: true },
          usernames: { isEnabled: true },
        } as unknown as Style,
      });
      institutionsRepo.find.mockResolvedValue([inst]);

      const result = await service.getAllStyles();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('inst-1');
      expect(result[0].company.primaryColor).toBe('#000');
    });

    it('should default gif and usernames when not present in style', async () => {
      const inst = buildInstitution({
        defaultStyle: {
          id: 'style-1',
          company: {
            primaryColor: '#000',
            background: { type: 'solid', color: '#fff' },
            logo: null,
            favicon: null,
          },
          questions: {
            mainColor: '#FF9800',
            backgroundColor: '#FFF3E0',
            badge: { iconName: 'question', color: '#FF9800' },
            keyword: '@question',
            isEnabled: true,
          },
          mentions: { mainColor: '#2196F3', backgroundColor: '#E3F2FD', isEnabled: true },
          moderator: {
            mainColor: '#F44336',
            backgroundColor: '#F443361A',
            badge: { iconName: 'shield', color: '#F44336' },
            isEnabled: true,
          },
          gif: undefined,
          usernames: undefined,
        } as unknown as Style,
      });
      institutionsRepo.find.mockResolvedValue([inst]);

      const result = await service.getAllStyles();

      expect(result[0].gif).toEqual({ isEnabled: true });
      expect(result[0].usernames).toEqual({ isEnabled: true });
    });
  });

  // ---------- findAllWithAdminEmails ----------
  describe('findAllWithAdminEmails', () => {
    it('should return admin email from oldest active user', async () => {
      const users = [
        { email: 'new@test.com', isActive: true, createdAt: new Date('2025-06-01') } as User,
        { email: 'old@test.com', isActive: true, createdAt: new Date('2025-01-01') } as User,
        { email: 'inactive@test.com', isActive: false, createdAt: new Date('2024-01-01') } as User,
      ];
      const inst = buildInstitution({ users });
      institutionsRepo.find.mockResolvedValue([inst]);

      const result = await service.findAllWithAdminEmails();

      expect(result[0].adminEmail).toBe('old@test.com');
    });

    it('should return undefined adminEmail when no active users', async () => {
      const inst = buildInstitution({ users: [] });
      institutionsRepo.find.mockResolvedValue([inst]);

      const result = await service.findAllWithAdminEmails();

      expect(result[0].adminEmail).toBeUndefined();
    });
  });
});
