import {
  Injectable,
  ForbiddenException,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ThemeTemplate } from './entities/theme-template.entity';
import { Style } from '../institutions/entities/style.entity';
import { Institution } from '../institutions/entities/institution.entity';
import { Workspace } from '../institutions/entities/workspace.entity';
import { User } from '../user/entities/user.entity';
import {
  ImportThemeDto,
  SaveCurrentThemeDto,
  UpdateThemeTemplateDto,
} from './dto/theme-template.dto';
import { PREDEFINED_THEMES } from './data/predefined-themes';

/**
 * Service for managing theme templates and applying them to institutions/workspaces.
 *
 * Theme application preserves logo and favicon from the current style while
 * overriding all color, background, and module configurations.
 *
 * Seeds predefined themes on startup if the table is empty
 * (since synchronize:true bypasses migration files).
 */
@Injectable()
export class ThemesService implements OnModuleInit {
  private readonly logger = new Logger(ThemesService.name);

  constructor(
    @InjectRepository(ThemeTemplate)
    private readonly themeTemplateRepository: Repository<ThemeTemplate>,
    @InjectRepository(Style)
    private readonly stylesRepository: Repository<Style>,
    @InjectRepository(Institution)
    private readonly institutionsRepository: Repository<Institution>,
    @InjectRepository(Workspace)
    private readonly workspacesRepository: Repository<Workspace>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Seeds or updates predefined themes on startup.
   * Uses upsert by slug so that corrections (icon names, keywords, etc.)
   * are applied to existing rows without losing custom themes.
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Syncing predefined theme templates...');
    let created = 0;
    let updated = 0;

    for (const theme of PREDEFINED_THEMES) {
      const existing = await this.themeTemplateRepository.findOne({
        where: { slug: theme.slug as string },
      });

      if (existing) {
        await this.themeTemplateRepository.update(existing.id, {
          ...theme,
          slug: undefined, // slug is unique, don't overwrite with itself
        });
        updated++;
      } else {
        const entity = this.themeTemplateRepository.create(theme);
        await this.themeTemplateRepository.save(entity);
        created++;
      }
    }

    this.logger.log(`Predefined themes: ${created} created, ${updated} updated`);
  }

  /**
   * Returns all active theme templates visible to the given institution.
   * Includes predefined themes (institutionId IS NULL) and the institution's own custom themes.
   *
   * @param institutionId - Caller's institution UUID
   */
  async findAll(institutionId: string): Promise<ThemeTemplate[]> {
    return this.themeTemplateRepository
      .createQueryBuilder('t')
      .where('t.isActive = :active', { active: true })
      .andWhere('(t.institutionId IS NULL OR t.institutionId = :institutionId)', { institutionId })
      .orderBy('t.sortOrder', 'ASC')
      .getMany();
  }

  /**
   * Returns a single theme template by ID, if it is visible to the given institution.
   * Predefined templates (institutionId IS NULL) are visible to everyone.
   *
   * @param id - Theme template UUID
   * @param institutionId - Caller's institution UUID
   * @throws NotFoundException if not found or not accessible
   */
  async findById(id: string, institutionId?: string): Promise<ThemeTemplate> {
    const template = await this.themeTemplateRepository.findOne({
      where: { id, isActive: true },
    });
    if (!template) {
      throw new NotFoundException('Theme template not found');
    }
    if (
      institutionId &&
      template.institutionId !== null &&
      template.institutionId !== institutionId
    ) {
      throw new NotFoundException('Theme template not found');
    }
    return template;
  }

  /**
   * Soft-deletes a custom theme template.
   * Only templates with `category === 'custom'` that belong to the institution can be deleted.
   *
   * @param id - Theme template UUID
   * @param institutionId - Caller's institution UUID
   * @throws NotFoundException if the template does not exist
   * @throws ForbiddenException if the template is predefined or belongs to another institution
   */
  async deleteCustomTemplate(id: string, institutionId: string): Promise<void> {
    const template = await this.themeTemplateRepository.findOne({
      where: { id, isActive: true },
    });
    if (!template) {
      throw new NotFoundException('Theme template not found');
    }
    if (template.category !== 'custom') {
      throw new ForbiddenException('Predefined themes cannot be deleted');
    }
    if (template.institutionId !== institutionId) {
      throw new ForbiddenException('You can only delete your own custom themes');
    }
    await this.themeTemplateRepository.update(id, { isActive: false });
  }

  /**
   * Updates the metadata (name and/or description) of a custom theme template.
   * Only templates with `category === 'custom'` that belong to the institution can be edited.
   *
   * @param id - Theme template UUID
   * @param dto - Fields to update
   * @param institutionId - Caller's institution UUID
   * @returns Updated theme template
   * @throws NotFoundException if the template does not exist
   * @throws ForbiddenException if the template is predefined or belongs to another institution
   */
  async updateCustomTemplate(
    id: string,
    dto: UpdateThemeTemplateDto,
    institutionId: string,
  ): Promise<ThemeTemplate> {
    const template = await this.themeTemplateRepository.findOne({
      where: { id, isActive: true },
    });
    if (!template) {
      throw new NotFoundException('Theme template not found');
    }
    if (template.category !== 'custom') {
      throw new ForbiddenException('Predefined themes cannot be edited');
    }
    if (template.institutionId !== institutionId) {
      throw new ForbiddenException('You can only edit your own custom themes');
    }
    await this.themeTemplateRepository.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
    });
    return this.themeTemplateRepository.findOneOrFail({ where: { id } });
  }

  /**
   * Applies a predefined theme template to an institution's default style.
   * Preserves the current logo and favicon.
   *
   * @param themeId - Theme template UUID
   * @param institutionId - Target institution UUID
   * @returns Updated style
   */
  async applyToInstitution(themeId: string, institutionId: string): Promise<Style | null> {
    // Scope the lookup to the caller's institution: other tenants' custom templates are hidden
    const template = await this.findById(themeId, institutionId);
    const institution = await this.institutionsRepository.findOne({
      where: { id: institutionId, isActive: true },
      relations: ['defaultStyle'],
    });
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    const currentStyle = await this.stylesRepository.findOne({
      where: { id: institution.defaultStyle.id },
    });

    await this.stylesRepository.update(institution.defaultStyle.id, {
      company: {
        primaryColor: template.company.primaryColor,
        background: template.company.background,
        logo: currentStyle?.company.logo ?? null,
        favicon: currentStyle?.company.favicon ?? null,
      },
      questions: template.questions,
      mentions: template.mentions,
      moderator: template.moderator,
      gif: template.gif,
      appliedThemeTemplateId: template.id,
    });

    return this.stylesRepository.findOne({
      where: { id: institution.defaultStyle.id },
    });
  }

  /**
   * Applies a predefined theme template to a workspace style.
   * Creates the workspace style if it does not exist yet.
   * Preserves the current logo and favicon.
   *
   * @param themeId - Theme template UUID
   * @param institutionId - Parent institution UUID
   * @param workspaceId - Target workspace UUID
   * @returns Updated style
   */
  async applyToWorkspace(
    themeId: string,
    institutionId: string,
    workspaceId: string,
  ): Promise<Style | null> {
    // Scope the lookup to the caller's institution: other tenants' custom templates are hidden
    const template = await this.findById(themeId, institutionId);
    const workspace = await this.workspacesRepository.findOne({
      where: { id: workspaceId },
      relations: ['style', 'institution'],
    });
    if (!workspace || workspace.institution.id !== institutionId) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.style) {
      const currentStyle = await this.stylesRepository.findOne({
        where: { id: workspace.style.id },
      });

      await this.stylesRepository.update(workspace.style.id, {
        company: {
          primaryColor: template.company.primaryColor,
          background: template.company.background,
          logo: currentStyle?.company.logo ?? null,
          favicon: currentStyle?.company.favicon ?? null,
        },
        questions: template.questions,
        mentions: template.mentions,
        moderator: template.moderator,
        gif: template.gif,
        appliedThemeTemplateId: template.id,
      });

      return this.stylesRepository.findOne({
        where: { id: workspace.style.id },
      });
    }

    // No workspace style exists — create one based on the template
    const institution = await this.institutionsRepository.findOne({
      where: { id: institutionId },
      relations: ['defaultStyle'],
    });

    const newStyle = this.stylesRepository.create({
      company: {
        primaryColor: template.company.primaryColor,
        background: template.company.background,
        logo: institution?.defaultStyle?.company.logo ?? null,
        favicon: institution?.defaultStyle?.company.favicon ?? null,
      },
      questions: template.questions,
      mentions: template.mentions,
      moderator: template.moderator,
      gif: template.gif,
      usernames: { isEnabled: true },
      appliedThemeTemplateId: template.id,
      workspace,
    });

    const savedStyle = await this.stylesRepository.save(newStyle);
    workspace.style = savedStyle;
    await this.workspacesRepository.save(workspace);

    return savedStyle;
  }

  /**
   * Exports the current institution style as a portable JSON object.
   * Strips logo and favicon (binary data) from the export.
   *
   * @param institutionId - Source institution UUID
   * @returns Style data without logo/favicon
   */
  async exportCurrentTheme(institutionId: string): Promise<{
    name: string;
    company: { primaryColor: string; background: Record<string, unknown> };
    questions: Record<string, unknown>;
    mentions: Record<string, unknown>;
    moderator: Record<string, unknown>;
    gif: { isEnabled: boolean };
    usernames: { isEnabled: boolean };
  }> {
    const institution = await this.institutionsRepository.findOne({
      where: { id: institutionId, isActive: true },
      relations: ['defaultStyle'],
    });
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    const style = institution.defaultStyle;
    return {
      name: `Thème de ${institution.name}`,
      company: {
        primaryColor: style.company.primaryColor,
        background: style.company.background,
      },
      questions: style.questions,
      mentions: style.mentions,
      moderator: style.moderator,
      gif: style.gif ?? { isEnabled: true },
      usernames: style.usernames ?? { isEnabled: true },
    };
  }

  /**
   * Saves the current institution style as a custom template in the library.
   *
   * @param dto - Contains the name for the new template
   * @param institutionId - Source institution UUID
   * @param userId - ID of the user performing the save
   * @returns Created theme template
   */
  async saveCurrentAsTemplate(
    dto: SaveCurrentThemeDto,
    institutionId: string,
    userId: string,
  ): Promise<ThemeTemplate> {
    const institution = await this.institutionsRepository.findOne({
      where: { id: institutionId, isActive: true },
      relations: ['defaultStyle'],
    });
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    const userName = user ? `${user.firstName} ${user.lastName}` : 'un utilisateur';

    const style = institution.defaultStyle;
    const slug = this.generateSlug(dto.name);
    const maxOrder = await this.themeTemplateRepository
      .createQueryBuilder('t')
      .select('MAX(t.sortOrder)', 'max')
      .getRawOne();

    const background = style.company.background;
    const templateBg: ThemeTemplate['company']['background'] =
      background.type === 'image'
        ? { type: 'solid' as const, color: '#06172A' }
        : { type: background.type, color: background.color, gradient: background.gradient };

    const entity = this.themeTemplateRepository.create({
      slug,
      name: dto.name,
      description: `Thème personnalisé sauvegardé par ${userName} de ${institution.name}`,
      category: 'custom',
      institutionId,
      sortOrder: (maxOrder?.max ?? 10) + 1,
      isActive: true,
      company: { primaryColor: style.company.primaryColor, background: templateBg },
      questions: style.questions,
      mentions: style.mentions,
      moderator: style.moderator,
      gif: style.gif ?? { isEnabled: true },
    });

    const savedTemplate = await this.themeTemplateRepository.save(entity);

    // Link the current style to the newly saved template
    style.appliedThemeTemplateId = savedTemplate.id;
    await this.stylesRepository.save(style);

    return savedTemplate;
  }

  /**
   * Synchronises the current institution style back into a custom template.
   * Only templates with `category === 'custom'` can be synced.
   * Image backgrounds are converted to a solid fallback (templates don't carry binary data).
   *
   * @param templateId - Target theme template UUID
   * @param institutionId - Source institution UUID
   * @returns Updated theme template
   */
  async syncStyleToTemplate(templateId: string, institutionId: string): Promise<ThemeTemplate> {
    const template = await this.themeTemplateRepository.findOne({
      where: { id: templateId, isActive: true },
    });
    if (!template) {
      throw new NotFoundException('Theme template not found');
    }
    if (template.category !== 'custom') {
      throw new ForbiddenException('Predefined themes cannot be synced');
    }
    if (template.institutionId !== institutionId) {
      throw new ForbiddenException('You can only sync your own custom themes');
    }

    const institution = await this.institutionsRepository.findOne({
      where: { id: institutionId, isActive: true },
      relations: ['defaultStyle'],
    });
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    const style = institution.defaultStyle;

    // Image backgrounds are stripped from templates (binary data)
    const background = style.company.background;
    const templateBg: ThemeTemplate['company']['background'] =
      background.type === 'image'
        ? { type: 'solid' as const, color: '#06172A' }
        : { type: background.type, color: background.color, gradient: background.gradient };

    await this.themeTemplateRepository.update(templateId, {
      company: { primaryColor: style.company.primaryColor, background: templateBg },
      questions: style.questions,
      mentions: style.mentions,
      moderator: style.moderator,
      gif: style.gif ?? { isEnabled: true },
    });

    return this.themeTemplateRepository.findOneOrFail({ where: { id: templateId } });
  }

  /**
   * Imports a JSON theme definition, saves it as a template in the library,
   * and applies it to the institution or workspace.
   * Preserves the current logo and favicon.
   *
   * @param dto - Validated import payload (includes name)
   * @param institutionId - Target institution UUID
   * @returns The created theme template
   */
  async importAndApply(dto: ImportThemeDto, institutionId: string): Promise<ThemeTemplate> {
    // Save as template in the library
    const slug = this.generateSlug(dto.name);
    const maxOrder = await this.themeTemplateRepository
      .createQueryBuilder('t')
      .select('MAX(t.sortOrder)', 'max')
      .getRawOne();

    const dtoBg = dto.company.background;
    const importBg: ThemeTemplate['company']['background'] =
      dtoBg.type === 'image'
        ? { type: 'solid' as const, color: '#06172A' }
        : { type: dtoBg.type, color: dtoBg.color, gradient: dtoBg.gradient };

    const entity = this.themeTemplateRepository.create({
      slug,
      name: dto.name,
      description: 'Thème importé depuis un fichier JSON',
      category: 'custom',
      institutionId,
      sortOrder: (maxOrder?.max ?? 10) + 1,
      isActive: true,
      company: { primaryColor: dto.company.primaryColor, background: importBg },
      questions: {
        mainColor: dto.questions.mainColor,
        backgroundColor: dto.questions.backgroundColor,
        badge: dto.questions.badge ?? null,
        keyword: dto.questions.keyword,
        isEnabled: dto.questions.isEnabled ?? true,
      },
      mentions: {
        mainColor: dto.mentions.mainColor,
        backgroundColor: dto.mentions.backgroundColor,
        isEnabled: dto.mentions.isEnabled ?? true,
      },
      moderator: {
        mainColor: dto.moderator.mainColor,
        backgroundColor: dto.moderator.backgroundColor,
        badge: dto.moderator.badge ?? null,
        isEnabled: dto.moderator.isEnabled ?? true,
      },
      gif: { isEnabled: true },
    });

    const savedTemplate = await this.themeTemplateRepository.save(entity);

    // Also apply the theme (pass saved template ID for tracking)
    if (dto.workspaceId) {
      await this.applyImportToWorkspace(dto, institutionId, dto.workspaceId, savedTemplate.id);
    } else {
      await this.applyImportToInstitution(dto, institutionId, savedTemplate.id);
    }

    return savedTemplate;
  }

  /**
   * Generates a URL-safe slug from a display name.
   * Appends a random suffix to avoid collisions.
   */
  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const suffix = Math.random().toString(36).slice(2, 8);
    return `${base}-${suffix}`;
  }

  /**
   * Applies an imported theme to the institution's default style.
   */
  private async applyImportToInstitution(
    dto: ImportThemeDto,
    institutionId: string,
    templateId: string,
  ): Promise<Style | null> {
    const institution = await this.institutionsRepository.findOne({
      where: { id: institutionId, isActive: true },
      relations: ['defaultStyle'],
    });
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    const currentStyle = await this.stylesRepository.findOne({
      where: { id: institution.defaultStyle.id },
    });

    await this.stylesRepository.update(institution.defaultStyle.id, {
      company: {
        primaryColor: dto.company.primaryColor,
        background: dto.company.background,
        logo: currentStyle?.company.logo ?? null,
        favicon: currentStyle?.company.favicon ?? null,
      },
      questions: {
        mainColor: dto.questions.mainColor,
        backgroundColor: dto.questions.backgroundColor,
        badge: dto.questions.badge ?? currentStyle?.questions.badge ?? null,
        keyword: dto.questions.keyword,
        isEnabled: dto.questions.isEnabled ?? currentStyle?.questions.isEnabled ?? true,
      },
      mentions: {
        mainColor: dto.mentions.mainColor,
        backgroundColor: dto.mentions.backgroundColor,
        isEnabled: dto.mentions.isEnabled ?? currentStyle?.mentions.isEnabled ?? true,
      },
      moderator: {
        mainColor: dto.moderator.mainColor,
        backgroundColor: dto.moderator.backgroundColor,
        badge: dto.moderator.badge ?? currentStyle?.moderator.badge ?? null,
        isEnabled: dto.moderator.isEnabled ?? currentStyle?.moderator.isEnabled ?? true,
      },
      appliedThemeTemplateId: templateId,
    });

    return this.stylesRepository.findOne({
      where: { id: institution.defaultStyle.id },
    });
  }

  /**
   * Applies an imported theme to a specific workspace style.
   */
  private async applyImportToWorkspace(
    dto: ImportThemeDto,
    institutionId: string,
    workspaceId: string,
    templateId: string,
  ): Promise<Style | null> {
    const workspace = await this.workspacesRepository.findOne({
      where: { id: workspaceId },
      relations: ['style', 'institution'],
    });
    if (!workspace || workspace.institution.id !== institutionId) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.style) {
      const currentStyle = await this.stylesRepository.findOne({
        where: { id: workspace.style.id },
      });

      await this.stylesRepository.update(workspace.style.id, {
        company: {
          primaryColor: dto.company.primaryColor,
          background: dto.company.background,
          logo: currentStyle?.company.logo ?? null,
          favicon: currentStyle?.company.favicon ?? null,
        },
        questions: {
          mainColor: dto.questions.mainColor,
          backgroundColor: dto.questions.backgroundColor,
          badge: dto.questions.badge ?? currentStyle?.questions.badge ?? null,
          keyword: dto.questions.keyword,
          isEnabled: dto.questions.isEnabled ?? currentStyle?.questions.isEnabled ?? true,
        },
        mentions: {
          mainColor: dto.mentions.mainColor,
          backgroundColor: dto.mentions.backgroundColor,
          isEnabled: dto.mentions.isEnabled ?? currentStyle?.mentions.isEnabled ?? true,
        },
        moderator: {
          mainColor: dto.moderator.mainColor,
          backgroundColor: dto.moderator.backgroundColor,
          badge: dto.moderator.badge ?? currentStyle?.moderator.badge ?? null,
          isEnabled: dto.moderator.isEnabled ?? currentStyle?.moderator.isEnabled ?? true,
        },
        appliedThemeTemplateId: templateId,
      });

      return this.stylesRepository.findOne({
        where: { id: workspace.style.id },
      });
    }

    // Create new workspace style from import
    const institution = await this.institutionsRepository.findOne({
      where: { id: institutionId },
      relations: ['defaultStyle'],
    });

    const newStyle = this.stylesRepository.create({
      company: {
        primaryColor: dto.company.primaryColor,
        background: dto.company.background,
        logo: institution?.defaultStyle?.company.logo ?? null,
        favicon: institution?.defaultStyle?.company.favicon ?? null,
      },
      questions: {
        mainColor: dto.questions.mainColor,
        backgroundColor: dto.questions.backgroundColor,
        badge: dto.questions.badge ?? null,
        keyword: dto.questions.keyword,
        isEnabled: dto.questions.isEnabled ?? true,
      },
      mentions: {
        mainColor: dto.mentions.mainColor,
        backgroundColor: dto.mentions.backgroundColor,
        isEnabled: dto.mentions.isEnabled ?? true,
      },
      moderator: {
        mainColor: dto.moderator.mainColor,
        backgroundColor: dto.moderator.backgroundColor,
        badge: dto.moderator.badge ?? null,
        isEnabled: dto.moderator.isEnabled ?? true,
      },
      gif: { isEnabled: true },
      usernames: { isEnabled: true },
      appliedThemeTemplateId: templateId,
      workspace,
    });

    const savedStyle = await this.stylesRepository.save(newStyle);
    workspace.style = savedStyle;
    await this.workspacesRepository.save(workspace);

    return savedStyle;
  }
}
