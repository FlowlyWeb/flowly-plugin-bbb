import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Institution } from './entities/institution.entity';
import { Repository } from 'typeorm';
import { Style } from './entities/style.entity';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { User } from '../user/entities/user.entity';
import { UpdateModulesDto } from './dto/update-modules.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { UpdateLogoDto } from './dto/update-logo.dto';
import { UpdateFaviconDto } from './dto/update-favicon.dto';
import { UpdateColorsDto } from './dto/update-colors.dto';
import { StylesResponseDto } from './dto/get-style-response.dto';
import { BbbSettingsService } from './services/bbb-settings.service';
import { InstitutionFeaturesDto } from './dto/institution-features.dto';
import { ConfigService } from '@nestjs/config';
import { FeaturesService } from '../common/services/features.service';
import { ThemeTemplate } from '../themes/entities/theme-template.entity';

/**
 * Service for managing institutions
 *
 * Handles institution creation, retrieval, and styling/customization.
 * flowly-api is the source of truth for institutions in the Flowly ecosystem.
 */
@Injectable()
export class InstitutionsService {
  constructor(
    @InjectRepository(Institution)
    private institutionsRepository: Repository<Institution>,
    @InjectRepository(Style)
    private stylesRepository: Repository<Style>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(ThemeTemplate)
    private themeTemplateRepository: Repository<ThemeTemplate>,
    @Inject(forwardRef(() => BbbSettingsService))
    private bbbSettingsService: BbbSettingsService,
    private eventEmitter: EventEmitter2,
    private configService: ConfigService,
    private featuresService: FeaturesService,
  ) {}

  /**
   * Checks whether the linked theme template is predefined.
   * If so, clears the link (predefined themes cannot be synced back).
   * Custom templates keep the link so the user can sync later.
   *
   * @returns The value to set for appliedThemeTemplateId in the update
   */
  private async resolveThemeLinkOnEdit(styleId: string): Promise<string | null | undefined> {
    const style = await this.stylesRepository.findOne({ where: { id: styleId } });
    if (!style?.appliedThemeTemplateId) return undefined; // no link, nothing to change

    const template = await this.themeTemplateRepository.findOne({
      where: { id: style.appliedThemeTemplateId },
    });

    // Clear the link only for predefined themes — custom themes keep it
    if (!template || template.category === 'predefined') {
      return null;
    }
    return undefined; // custom template → don't touch the field
  }

  /**
   * Retrieves all active institution domains
   * Used for dynamic CORS configuration
   *
   * @returns Array of active institution domains
   */
  async findAllActiveDomains(): Promise<string[]> {
    const institutions = await this.institutionsRepository.find({
      where: { isActive: true },
      select: ['domain'],
    });

    return institutions.map((inst) => inst.domain);
  }

  /**
   * Creates a new institution with default styles and BBB settings
   *
   * @param createDto - Institution creation data
   * @returns Created institution
   */
  async create(createDto: CreateInstitutionDto) {
    // Create default styles
    const defaultStyles = this.stylesRepository.create({
      company: {
        primaryColor: '#0F70D7',
        background: {
          type: 'solid' as const,
          color: '#06172A',
        },
        logo: null,
        favicon: null,
      },
      questions: {
        mainColor: '#FF9800',
        backgroundColor: '#FFF3E0',
        badge: {
          iconName: 'question',
          color: '#FF9800',
        },
        keyword: '@question',
        isEnabled: true,
      },
      mentions: {
        mainColor: '#2196F3',
        backgroundColor: '#E3F2FD',
        isEnabled: true,
      },
      moderator: {
        mainColor: '#F44336',
        backgroundColor: '#F443361A',
        badge: {
          iconName: 'shield',
          color: '#F44336',
        },
        isEnabled: true,
      },
      gif: {
        isEnabled: true,
      },
      usernames: {
        isEnabled: true,
      },
    });

    const savedStyles = await this.stylesRepository.save(defaultStyles);

    // Map allowed fields explicitly: pricing tier, quotas, activation and ids
    // keep their database defaults and can never be set by the caller.
    const institution = this.institutionsRepository.create({
      name: createDto.name,
      domain: createDto.domain,
      address: createDto.address,
      vatNumber: createDto.vatNumber,
      ...(createDto.geoRegion !== undefined && { geoRegion: createDto.geoRegion }),
      defaultStyle: savedStyles,
    });

    const savedInstitution = await this.institutionsRepository.save(institution);

    // Initialize default BBB settings for the institution
    try {
      await this.bbbSettingsService.create(savedInstitution.id, {});
      // eslint-disable-next-line no-console
      console.log(`BBB settings initialized for institution ${savedInstitution.id}`);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn(
        `Failed to initialize BBB settings for institution ${savedInstitution.id}:`,
        error,
      );
    }

    this.eventEmitter.emit('institution.created', savedInstitution);

    return savedInstitution;
  }

  /**
   * Finds an institution by ID
   *
   * @param id - Institution ID
   * @returns Institution or null if not found
   */
  async findById(id: string): Promise<Institution | null> {
    return this.institutionsRepository.findOne({
      where: {
        id,
        isActive: true,
      },
      relations: ['defaultStyle'],
    });
  }

  /**
   * Updates institution properties (pricing tier, quotas)
   * Called by flowly-core to synchronize subscription/trial status
   *
   * @param id - Institution ID
   * @param updateDto - Updated properties
   * @returns Updated institution
   */
  async update(id: string, updateDto: UpdateInstitutionDto): Promise<Institution> {
    const institution = await this.institutionsRepository.findOne({
      where: { id },
      relations: ['defaultStyle'],
    });

    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    // Update only provided fields
    if (updateDto.currentPricingTier !== undefined) {
      institution.currentPricingTier = updateDto.currentPricingTier;
    }

    if (updateDto.quotaServerLimit !== undefined) {
      institution.quotaServerLimit = updateDto.quotaServerLimit;
    }

    if (updateDto.quotaSubOrgLimit !== undefined) {
      institution.quotaSubOrgLimit = updateDto.quotaSubOrgLimit;
    }

    if (updateDto.name !== undefined) {
      institution.name = updateDto.name;
    }

    if (updateDto.domain !== undefined) {
      institution.domain = updateDto.domain;
    }

    if (updateDto.address !== undefined) {
      institution.address = updateDto.address;
    }

    if (updateDto.vatNumber !== undefined) {
      institution.vatNumber = updateDto.vatNumber;
    }

    if (updateDto.geoRegion !== undefined) {
      institution.geoRegion = updateDto.geoRegion;
    }

    if (updateDto.isActive !== undefined) {
      institution.isActive = updateDto.isActive;
    }

    const updated = await this.institutionsRepository.save(institution);

    // Emit event for potential listeners (analytics, logging, etc.)
    this.eventEmitter.emit('institution.updated', {
      institutionId: id,
      changes: updateDto,
    });

    return updated;
  }

  /**
   * Deletes an institution and all related data
   * WARNING: This is a hard delete and cannot be undone
   *
   * @param id - Institution ID
   */
  async remove(id: string): Promise<void> {
    const institution = await this.institutionsRepository.findOne({
      where: { id },
    });

    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    await this.institutionsRepository.remove(institution);

    this.eventEmitter.emit('institution.deleted', {
      institutionId: id,
      institutionName: institution.name,
    });
  }

  /**
   * Finds all institutions
   * Used by flowly-core for admin dashboard
   *
   * @returns Array of all institutions
   */
  async findAll(): Promise<Institution[]> {
    return this.institutionsRepository.find({
      relations: ['defaultStyle'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Finds all institutions with admin emails
   * Protected endpoint - only accessible with API key authentication
   * Used by flowly-core admin dashboard
   *
   * @returns Array of institutions with oldest user email
   */
  async findAllWithAdminEmails(): Promise<Array<Institution & { adminEmail?: string }>> {
    const institutions = await this.institutionsRepository.find({
      relations: ['defaultStyle', 'users'],
      order: {
        createdAt: 'DESC',
      },
    });

    // Enrich each institution with oldest user email
    return institutions.map((institution) => {
      // Find oldest user (by createdAt ASC) who is active
      const oldestUser = institution.users
        ?.filter((user) => user.isActive)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];

      return {
        ...institution,
        adminEmail: oldestUser?.email,
      };
    });
  }

  /**
   * Finds an institution by origin header
   * Matches against domain and subdomains
   *
   * @param origin - Origin header from request
   * @returns Institution or null if not found
   */
  async findByOrigin(origin: string): Promise<Institution | null> {
    // Clean origin to get hostname only
    const hostname = origin
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split(':')[0];

    // Extract main domain and all possible subdomains
    const domainParts = hostname.split('.');
    const possibleDomains: string[] = [];

    // Generate all possible domain combinations
    // For example for "visio.example.com":
    // 1. "visio.example.com"
    // 2. "example.com"
    for (let i = 0; i < domainParts.length - 1; i++) {
      possibleDomains.push(domainParts.slice(i).join('.'));
    }

    // Search for institution matching one of the possible domains
    // Start with the full domain, then try more general domains
    for (const domain of possibleDomains) {
      const institution = await this.institutionsRepository.findOne({
        where: {
          domain,
          isActive: true,
        },
        relations: ['defaultStyle'],
      });

      if (institution) {
        return institution;
      }
    }

    // No match found
    return null;
  }

  /**
   * Updates institution logo
   *
   * @param institutionId - Institution ID
   * @param updateLogoDto - Logo update data
   * @returns Updated style
   */
  async updateLogo(institutionId: string, updateLogoDto: UpdateLogoDto) {
    const institution = await this.findById(institutionId);
    if (!institution) {
      throw new UnauthorizedException();
    }

    // Get current style to preserve other company settings
    const currentStyle = await this.stylesRepository.findOne({
      where: { id: institution.defaultStyle.id },
    });

    // Update the style with new logo in company object
    await this.stylesRepository.update(institution.defaultStyle.id, {
      company: {
        ...currentStyle?.company, // Keep existing company settings
        logo: updateLogoDto.logo, // Update only the logo
      },
    });

    // Return updated style
    return this.stylesRepository.findOne({
      where: { id: institution.defaultStyle.id },
    });
  }

  /**
   * Updates institution favicon
   *
   * @param institutionId - Institution ID
   * @param updateFaviconDto - Favicon update data
   * @returns Updated style
   */
  async updateFavicon(institutionId: string, updateFaviconDto: UpdateFaviconDto) {
    const institution = await this.findById(institutionId);
    if (!institution) {
      throw new UnauthorizedException();
    }

    // Get current style to preserve other company settings
    const currentStyle = await this.stylesRepository.findOne({
      where: { id: institution.defaultStyle.id },
    });

    // Update the style with new favicon in company object
    await this.stylesRepository.update(institution.defaultStyle.id, {
      company: {
        ...currentStyle?.company, // Keep existing company settings
        favicon: updateFaviconDto.favicon, // Update only the favicon
      },
    });

    // Return updated style
    return this.stylesRepository.findOne({
      where: { id: institution.defaultStyle.id },
    });
  }

  /**
   * Updates institution company colors only
   * Available for Starter tier and above
   *
   * @param institutionId - Institution ID
   * @param updateColorsDto - Colors update data
   * @returns Updated style
   */
  async updateColors(institutionId: string, updateColorsDto: UpdateColorsDto) {
    const institution = await this.findById(institutionId);
    if (!institution) {
      throw new UnauthorizedException();
    }

    // Get current style to preserve other company settings
    const currentStyle = await this.stylesRepository.findOne({
      where: { id: institution.defaultStyle.id },
    });

    // Update only the colors, preserve logo and other settings
    const themeLink = await this.resolveThemeLinkOnEdit(institution.defaultStyle.id);
    await this.stylesRepository.update(institution.defaultStyle.id, {
      company: {
        ...currentStyle?.company,
        primaryColor: updateColorsDto.primaryColor ?? currentStyle?.company.primaryColor,
        background: updateColorsDto.background ?? currentStyle?.company.background,
      },
      ...(themeLink !== undefined && { appliedThemeTemplateId: themeLink }),
    });

    // Return updated style
    return this.stylesRepository.findOne({
      where: { id: institution.defaultStyle.id },
    });
  }

  /**
   * Updates institution theme (colors and styling)
   *
   * @param institutionId - Institution ID
   * @param updateThemeDto - Theme update data
   * @returns Updated style
   */
  async updateTheme(institutionId: string, updateThemeDto: UpdateThemeDto) {
    const institution = await this.findById(institutionId);

    if (!institution) {
      throw new UnauthorizedException();
    }

    const currentStyle = await this.stylesRepository.findOne({
      where: { id: institution.defaultStyle.id },
    });

    // Prepare questions update with explicit badge handling
    const questionsUpdate = {
      ...currentStyle?.questions,
      mainColor: updateThemeDto.questions.mainColor,
      backgroundColor: updateThemeDto.questions.backgroundColor,
      keyword: updateThemeDto.questions.keyword,
    };

    // Only add badge if explicitly defined in request
    if ('badge' in updateThemeDto.questions) {
      questionsUpdate.badge = updateThemeDto.questions.badge;
    }

    // Prepare moderator update with explicit badge handling
    const moderatorUpdate = {
      ...currentStyle?.moderator,
      mainColor: updateThemeDto.moderator.mainColor,
      backgroundColor: updateThemeDto.moderator.backgroundColor,
    };

    // Only add badge if explicitly defined in request
    if ('badge' in updateThemeDto.moderator) {
      moderatorUpdate.badge = updateThemeDto.moderator.badge;
    }

    const updatedStyle = {
      ...currentStyle,
      company: {
        primaryColor: updateThemeDto.company.primaryColor,
        background: updateThemeDto.company.background,
        logo:
          updateThemeDto.company.logo !== undefined
            ? updateThemeDto.company.logo
            : currentStyle?.company.logo,
        favicon: currentStyle?.company.favicon,
      },
      questions: questionsUpdate,
      mentions: {
        ...currentStyle?.mentions,
        mainColor: updateThemeDto.mentions.mainColor,
        backgroundColor: updateThemeDto.mentions.backgroundColor,
      },
      moderator: moderatorUpdate,
    };

    const themeLink = await this.resolveThemeLinkOnEdit(institution.defaultStyle.id);
    await this.stylesRepository.update(institution.defaultStyle.id, {
      ...updatedStyle,
      ...(themeLink !== undefined && { appliedThemeTemplateId: themeLink }),
    });

    return this.stylesRepository.findOne({
      where: { id: institution.defaultStyle.id },
    });
  }

  /**
   * Updates module enable/disable states
   *
   * @param institutionId - Institution ID
   * @param updateModulesDto - Module states
   * @returns Updated style
   */
  async updateModules(institutionId: string, updateModulesDto: UpdateModulesDto) {
    const institution = await this.findById(institutionId);

    if (!institution) {
      throw new UnauthorizedException();
    }

    const currentStyle = await this.stylesRepository.findOne({
      where: { id: institution.defaultStyle.id },
    });

    const updatedStyle = {
      ...currentStyle,
      questions: {
        ...currentStyle?.questions,
        isEnabled: updateModulesDto.questionsEnabled,
      },
      mentions: {
        ...currentStyle?.mentions,
        isEnabled: updateModulesDto.mentionsEnabled,
      },
      moderator: {
        ...currentStyle?.moderator,
        isEnabled: updateModulesDto.moderatorEnabled,
      },
      gif: {
        ...currentStyle?.gif,
        isEnabled: updateModulesDto.gifEnabled,
      },
      usernames: {
        ...currentStyle?.usernames,
        isEnabled: updateModulesDto.usernamesEnabled,
      },
    };

    const themeLink = await this.resolveThemeLinkOnEdit(institution.defaultStyle.id);
    await this.stylesRepository.update(institution.defaultStyle.id, {
      ...updatedStyle,
      ...(themeLink !== undefined && { appliedThemeTemplateId: themeLink }),
    });

    return this.stylesRepository.findOne({
      where: { id: institution.defaultStyle.id },
    });
  }

  /**
   * Retrieves all styles for all active institutions
   * Used by the BBB plugin to fetch styling configuration
   *
   * @returns Array of institution styles
   */
  async getAllStyles(): Promise<StylesResponseDto[]> {
    const institutions = await this.institutionsRepository.find({
      where: { isActive: true },
      relations: ['defaultStyle'],
      select: ['id', 'name'],
    });

    return institutions.map((institution) => ({
      id: institution.id,
      name: institution.name,
      company: institution.defaultStyle.company,
      questions: institution.defaultStyle.questions,
      mentions: institution.defaultStyle.mentions,
      moderator: institution.defaultStyle.moderator,
      gif: institution.defaultStyle.gif ?? { isEnabled: true },
      usernames: institution.defaultStyle.usernames ?? { isEnabled: true },
    }));
  }

  /**
   * Finds an institution by domain
   * Returns full institution details including admin email (first active user)
   *
   * @param domain - Institution domain
   * @returns Institution with admin email or null if not found
   */
  async findByDomain(domain: string): Promise<(Institution & { adminEmail?: string }) | null> {
    const institution = await this.institutionsRepository.findOne({
      where: { domain, isActive: true },
      relations: ['defaultStyle', 'users'],
    });

    if (!institution) {
      return null;
    }

    // Find first active user as admin email
    const adminUser = institution.users?.find((user) => user.isActive);

    return {
      ...institution,
      adminEmail: adminUser?.email,
    };
  }

  /**
   * Updates institution status by Mollie customer ID
   * Used by flowly-core to activate/deactivate institutions based on subscription status
   *
   * @param customerId - Mollie customer ID
   * @param isActive - New active status
   * @returns Updated institution or null if not found
   */
  async updateStatusByCustomerId(
    customerId: string,
    isActive: boolean,
  ): Promise<Institution | null> {
    // TODO: This requires a mapping table (MollieCustomer) that links customerId to institutionId
    // For now, this method is not fully implemented
    // The MollieCustomer entity should be created in flowly-core and synchronized here

    // Placeholder implementation that logs the action
    // eslint-disable-next-line no-console
    console.log(
      `[InstitutionsService] Request to update institution status for customer ${customerId} to ${isActive ? 'active' : 'inactive'}`,
    );
    // eslint-disable-next-line no-console
    console.warn(
      '[InstitutionsService] updateStatusByCustomerId not fully implemented - requires MollieCustomer mapping',
    );

    // Return null to indicate operation couldn't be completed
    // flowly-core should handle this gracefully
    return null;
  }

  /**
   * Resets institution styles to default values
   * Available for all pricing tiers without restrictions
   *
   * @param institutionId - Institution ID
   * @returns Updated style with default values
   */
  async resetStyles(institutionId: string) {
    const institution = await this.findById(institutionId);

    if (!institution) {
      throw new UnauthorizedException();
    }

    // Define default style values (same as in create method)
    const defaultStyleValues = {
      company: {
        primaryColor: '#0F70D7',
        background: {
          type: 'solid' as const,
          color: '#06172A',
        },
        logo: null,
        favicon: null,
      },
      questions: {
        mainColor: '#FF9800',
        backgroundColor: '#FFF3E0',
        badge: {
          iconName: 'question',
          color: '#FF9800',
        },
        keyword: '@question',
        isEnabled: true,
      },
      mentions: {
        mainColor: '#2196F3',
        backgroundColor: '#E3F2FD',
        isEnabled: true,
      },
      moderator: {
        mainColor: '#F44336',
        backgroundColor: '#F443361A',
        badge: {
          iconName: 'shield',
          color: '#F44336',
        },
        isEnabled: true,
      },
      gif: {
        isEnabled: true,
      },
      usernames: {
        isEnabled: true,
      },
    };

    // Update the style with default values — clear theme tracking
    await this.stylesRepository.update(institution.defaultStyle.id, {
      ...defaultStyleValues,
      appliedThemeTemplateId: null,
    });

    // Return updated style
    return this.stylesRepository.findOne({
      where: { id: institution.defaultStyle.id },
    });
  }

  /**
   * Removes the link between the institution's style and its applied theme template.
   * The style itself is not modified — only the tracking field is cleared.
   *
   * @param institutionId - Institution ID
   * @returns Updated style
   */
  async unlinkTheme(institutionId: string) {
    const institution = await this.findById(institutionId);
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    await this.stylesRepository.update(institution.defaultStyle.id, {
      appliedThemeTemplateId: null,
    });

    return this.stylesRepository.findOne({
      where: { id: institution.defaultStyle.id },
    });
  }

  /**
   * Get features for an institution based on pricing tier
   *
   * This method returns feature flags based on the institution's current pricing tier.
   * In on-premise mode, all features are enabled.
   * In SaaS mode, features are determined by the pricing tier via FeaturesService.
   *
   * @param institutionId - Institution ID
   * @returns Institution features including tier, quotas, and feature flags
   */
  async getFeaturesForInstitution(institutionId: string): Promise<InstitutionFeaturesDto> {
    const institution = await this.findById(institutionId);

    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    const deploymentMode = this.configService.get<string>('deploymentMode', 'saas');
    const isOnPremise = deploymentMode === 'onpremise';

    // Get features from FeaturesService (centralized feature matrix)
    let features = this.featuresService.getFeaturesForTier(institution.currentPricingTier);

    // In on-premise mode, enable all features regardless of tier
    if (isOnPremise) {
      features = {
        customizeLogo: true,
        basicMentionsOnly: true,
        customizeColors: true,
        highlightModerators: true,
        generateYAMLConfig: true,
        completeTheme: true,
        mentionUsers: true,
        realtimeModification: true,
        subOrganizations: true,
        gifModule: true,
        usernamesModule: true,
      };
    }

    return {
      tier: institution.currentPricingTier,
      planName: this.featuresService.getPlanName(institution.currentPricingTier),
      quotaServers: {
        used: institution.quotaServersUsed,
        limit: isOnPremise ? 999999 : institution.quotaServerLimit,
        isLimitReached:
          !isOnPremise && institution.quotaServersUsed >= institution.quotaServerLimit,
      },
      quotaSubOrgs: {
        used: institution.quotaSubOrgsUsed,
        limit: isOnPremise ? 999999 : institution.quotaSubOrgLimit,
        isLimitReached:
          !isOnPremise && institution.quotaSubOrgsUsed >= institution.quotaSubOrgLimit,
      },
      features,
      deploymentMode,
    };
  }
}
