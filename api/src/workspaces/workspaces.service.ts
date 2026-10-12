import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Workspace } from '../institutions/entities/workspace.entity';
import { Style } from '../institutions/entities/style.entity';
import { Institution } from '../institutions/entities/institution.entity';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';

/**
 * Service for managing workspaces
 * Workspaces are sub-organizations within an institution that can have their own styling
 */
@Injectable()
export class WorkspacesService {
  private readonly logger = new Logger(WorkspacesService.name);

  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepository: Repository<Workspace>,
    @InjectRepository(Style)
    private readonly styleRepository: Repository<Style>,
    @InjectRepository(Institution)
    private readonly institutionRepository: Repository<Institution>,
  ) {}

  /**
   * Creates a new workspace for an institution
   * @param institutionId - The institution ID
   * @param createDto - Workspace creation data
   * @returns The created workspace
   */
  async create(institutionId: string, createDto: CreateWorkspaceDto): Promise<Workspace> {
    // Verify institution exists
    const institution = await this.institutionRepository.findOne({
      where: { id: institutionId },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${institutionId} not found`);
    }

    // Check if code is unique within this institution's active workspaces
    const existingWorkspace = await this.workspaceRepository.findOne({
      where: { code: createDto.code, institutionId, isActive: true },
    });

    if (existingWorkspace) {
      throw new ConflictException(`Workspace with code '${createDto.code}' already exists`);
    }

    // Create workspace (explicit fields only, institutionId always comes from the route)
    const workspace = this.workspaceRepository.create({
      name: createDto.name,
      code: createDto.code,
      description: createDto.description,
      institutionId,
    });

    const savedWorkspace = await this.workspaceRepository.save(workspace);

    // Increment quota counter
    institution.quotaSubOrgsUsed += 1;
    await this.institutionRepository.save(institution);

    return savedWorkspace;
  }

  /**
   * Duplicates an existing workspace with a new name and code
   * The custom style (if exists) is also duplicated
   * @param institutionId - The institution ID
   * @param sourceWorkspaceId - The source workspace ID to duplicate
   * @param createDto - New workspace data (name, code, description)
   * @returns The duplicated workspace
   */
  async duplicate(
    institutionId: string,
    sourceWorkspaceId: string,
    createDto: CreateWorkspaceDto,
  ): Promise<Workspace> {
    // 1. Verify institution exists and check quota
    const institution = await this.institutionRepository.findOne({
      where: { id: institutionId },
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${institutionId} not found`);
    }

    if (institution.quotaSubOrgsUsed >= institution.quotaSubOrgLimit) {
      throw new BadRequestException(
        `Cannot duplicate workspace: quota limit reached (${institution.quotaSubOrgLimit} workspaces)`,
      );
    }

    // 2. Find source workspace with style
    const sourceWorkspace = await this.workspaceRepository.findOne({
      where: { id: sourceWorkspaceId, institutionId },
      relations: ['style'],
    });

    if (!sourceWorkspace) {
      throw new NotFoundException(`Source workspace with ID ${sourceWorkspaceId} not found`);
    }

    // 3. Validate new code uniqueness within this institution's active workspaces
    const existingWorkspace = await this.workspaceRepository.findOne({
      where: { code: createDto.code, institutionId, isActive: true },
    });

    if (existingWorkspace) {
      throw new ConflictException(`Workspace with code '${createDto.code}' already exists`);
    }

    // 4. Create new workspace
    const newWorkspace = this.workspaceRepository.create({
      name: createDto.name,
      code: createDto.code,
      description: createDto.description || sourceWorkspace.description,
      institutionId,
      isActive: true,
    });

    const savedWorkspace = await this.workspaceRepository.save(newWorkspace);

    // 5. Duplicate style if exists
    if (sourceWorkspace.style) {
      const duplicatedStyle = this.styleRepository.create({
        company: { ...sourceWorkspace.style.company },
        questions: { ...sourceWorkspace.style.questions },
        mentions: { ...sourceWorkspace.style.mentions },
        moderator: { ...sourceWorkspace.style.moderator },
        gif: { ...(sourceWorkspace.style.gif ?? { isEnabled: true }) },
        usernames: { ...(sourceWorkspace.style.usernames ?? { isEnabled: true }) },
        workspace: savedWorkspace,
      });

      const savedStyle = await this.styleRepository.save(duplicatedStyle);
      savedWorkspace.style = savedStyle;
    }

    // 6. Increment quota
    institution.quotaSubOrgsUsed += 1;
    await this.institutionRepository.save(institution);

    this.logger.log(
      `Duplicated workspace ${sourceWorkspaceId} to ${savedWorkspace.id} for institution ${institutionId}`,
    );

    return savedWorkspace;
  }

  /**
   * Finds all workspaces for an institution
   * @param institutionId - The institution ID
   * @param includeInactive - Whether to include inactive workspaces
   * @returns Array of workspaces
   */
  async findAll(institutionId: string, includeInactive: boolean = false): Promise<Workspace[]> {
    const queryBuilder = this.workspaceRepository
      .createQueryBuilder('workspace')
      .leftJoinAndSelect('workspace.style', 'style')
      .where('workspace.institutionId = :institutionId', { institutionId });

    if (!includeInactive) {
      queryBuilder.andWhere('workspace.isActive = :isActive', { isActive: true });
    }

    return queryBuilder.orderBy('workspace.name', 'ASC').getMany();
  }

  /**
   * Finds a workspace by ID
   * @param id - The workspace ID
   * @param institutionId - The institution ID (for authorization check)
   * @returns The workspace
   */
  async findOne(id: string, institutionId: string): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findOne({
      where: { id, institutionId },
      relations: ['style', 'institution'],
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace with ID ${id} not found`);
    }

    return workspace;
  }

  /**
   * Finds a workspace by its unique code
   * Used by the plugin to fetch workspace-specific styles
   * @param code - The workspace code
   * @param institutionId - The institution ID
   * @returns The workspace with style, or null if not found
   */
  async findByCode(code: string, institutionId: string): Promise<Workspace | null> {
    return this.workspaceRepository.findOne({
      where: {
        code,
        institutionId,
        isActive: true,
      },
      relations: ['style', 'institution'],
    });
  }

  /**
   * Updates a workspace
   * @param id - The workspace ID
   * @param institutionId - The institution ID (for authorization check)
   * @param updateDto - Update data
   * @returns The updated workspace
   */
  async update(
    id: string,
    institutionId: string,
    updateDto: UpdateWorkspaceDto,
  ): Promise<Workspace> {
    const workspace = await this.findOne(id, institutionId);

    // If code is being updated, check uniqueness within this institution's active workspaces
    if (updateDto.code && updateDto.code !== workspace.code) {
      const existingWorkspace = await this.workspaceRepository.findOne({
        where: { code: updateDto.code, institutionId, isActive: true },
      });

      if (existingWorkspace) {
        throw new ConflictException(`Workspace with code '${updateDto.code}' already exists`);
      }
    }

    // Update workspace (explicit fields only, never id/institutionId/style)
    if (updateDto.name !== undefined) workspace.name = updateDto.name;
    if (updateDto.code !== undefined) workspace.code = updateDto.code;
    if (updateDto.description !== undefined) workspace.description = updateDto.description;
    if (updateDto.isActive !== undefined) workspace.isActive = updateDto.isActive;
    return this.workspaceRepository.save(workspace);
  }

  /**
   * Deletes a workspace and its associated style
   * @param id - The workspace ID
   * @param institutionId - The institution ID (for authorization check)
   */
  async remove(id: string, institutionId: string): Promise<void> {
    this.logger.debug(`Starting removal of workspace ${id} for institution ${institutionId}`);

    // Step 1: Find and verify workspace exists
    const workspace = await this.findOne(id, institutionId);
    this.logger.debug(`Found workspace ${id}: ${workspace.name} (code: ${workspace.code})`);

    try {
      // Step 2: Delete associated style first (if exists) to avoid foreign key constraint violation
      if (workspace.style) {
        const styleId = workspace.style.id;
        this.logger.debug(`Deleting associated style ${styleId} for workspace ${id}`);
        await this.styleRepository.delete(styleId);
        this.logger.debug(`Successfully deleted style ${styleId}`);
      }

      // Step 3: Remove workspace
      this.logger.debug(`Removing workspace ${id} from database`);
      await this.workspaceRepository.remove(workspace);
      this.logger.debug(`Successfully removed workspace ${id} from database`);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      this.logger.error(`Failed to remove workspace ${id} from database`, err.stack, {
        workspaceId: id,
        workspaceName: workspace.name,
        workspaceCode: workspace.code,
        institutionId,
        errorMessage: err.message,
      });
      throw error;
    }

    // Step 3: Decrement quota counter
    try {
      this.logger.debug(`Fetching institution ${institutionId} to update quota`);
      const institution = await this.institutionRepository.findOne({
        where: { id: institutionId },
      });

      if (!institution) {
        this.logger.warn(
          `Institution ${institutionId} not found when updating quota after workspace deletion`,
        );
        return;
      }

      if (institution.quotaSubOrgsUsed > 0) {
        const previousQuota = institution.quotaSubOrgsUsed;
        institution.quotaSubOrgsUsed -= 1;
        await this.institutionRepository.save(institution);
        this.logger.debug(
          `Updated institution ${institutionId} quota: ${previousQuota} -> ${institution.quotaSubOrgsUsed}`,
        );
      } else {
        this.logger.warn(`Institution ${institutionId} has quotaSubOrgsUsed = 0, cannot decrement`);
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      this.logger.error(`Failed to update institution quota after workspace deletion`, err.stack, {
        workspaceId: id,
        institutionId,
        errorMessage: err.message,
      });
      // Don't throw here - workspace is already deleted, quota update is secondary
      // This prevents partial state where workspace is deleted but quota not updated
    }

    this.logger.log(
      `Successfully completed removal of workspace ${id} from institution ${institutionId}`,
    );
  }

  /**
   * Gets the style for a workspace with inheritance from institution
   * If workspace has no style or some style fields are missing, inherits from institution's defaultStyle
   * @param workspaceCode - The workspace code
   * @param institutionId - The institution ID
   * @returns The merged style
   */
  async getStyleWithInheritance(
    workspaceCode: string,
    institutionId: string,
  ): Promise<Style | null> {
    const workspace = await this.findByCode(workspaceCode, institutionId);

    if (!workspace) {
      return null;
    }

    const institution = await this.institutionRepository.findOne({
      where: { id: institutionId },
      relations: ['defaultStyle'],
    });

    if (!institution?.defaultStyle) {
      return workspace.style || null;
    }

    // If workspace has no custom style, return institution's default style
    if (!workspace.style) {
      return institution.defaultStyle;
    }

    // Merge workspace style with institution default style
    // Workspace style takes precedence, but missing fields inherit from institution
    const mergedStyle = this.styleRepository.create({
      id: workspace.style.id,
      company: {
        ...institution.defaultStyle.company,
        ...workspace.style.company,
        // If logo is explicitly null in workspace, use institution's logo
        logo:
          workspace.style.company.logo !== undefined
            ? workspace.style.company.logo
            : institution.defaultStyle.company.logo,
      },
      questions: {
        ...institution.defaultStyle.questions,
        ...workspace.style.questions,
      },
      mentions: {
        ...institution.defaultStyle.mentions,
        ...workspace.style.mentions,
      },
      moderator: {
        ...institution.defaultStyle.moderator,
        ...workspace.style.moderator,
      },
      gif: {
        ...(institution.defaultStyle.gif ?? { isEnabled: true }),
        ...(workspace.style.gif || {}),
      },
      usernames: {
        ...(institution.defaultStyle.usernames ?? { isEnabled: true }),
        ...(workspace.style.usernames || {}),
      },
    });

    return mergedStyle;
  }

  /**
   * Resets workspace style to institution default values
   * Removes the custom workspace style, causing it to inherit from institution default
   * Available for all pricing tiers without restrictions
   * @param workspaceId - The workspace ID
   * @param institutionId - The institution ID (for authorization check)
   * @returns The institution's default style
   */
  async resetStyle(workspaceId: string, institutionId: string): Promise<Style> {
    const workspace = await this.findOne(workspaceId, institutionId);
    const institution = await this.institutionRepository.findOne({
      where: { id: institutionId },
      relations: ['defaultStyle'],
    });

    if (!institution) {
      throw new NotFoundException(`Institution with ID ${institutionId} not found`);
    }

    // If workspace has a custom style, remove it
    if (workspace.style) {
      const styleId = workspace.style.id;
      // First, delete the style from database
      await this.styleRepository.delete(styleId);
      // Then reload the workspace to reflect the cascade deletion
      await this.workspaceRepository
        .createQueryBuilder()
        .relation(Workspace, 'style')
        .of(workspace)
        .set(null);
    }

    // Return institution's default style
    return institution.defaultStyle;
  }

  /**
   * Creates or updates the style for a workspace
   * When creating a new style, initializes it with the institution's default style
   * to ensure all required fields are present in the database
   * @param workspaceId - The workspace ID
   * @param institutionId - The institution ID (for authorization check)
   * @param styleData - The partial style data to update (nested objects may have optional properties)
   * @returns The created/updated style
   */
  async createOrUpdateStyle(
    workspaceId: string,
    institutionId: string,
    styleData: Partial<Style>,
  ): Promise<Style> {
    const workspace = await this.findOne(workspaceId, institutionId);

    if (workspace.style) {
      // Update existing style - deep-merge provided data with existing style.
      // A shallow Object.assign would replace whole nested objects (e.g. `company`),
      // wiping fields not present in a partial payload such as logo/favicon/background.
      // Merge nested plain objects key by key; assign scalar/flat keys as-is so the
      // flat UpdateModulesRequest payload keeps its current behaviour.
      const isPlainObject = (value: unknown): value is Record<string, unknown> =>
        typeof value === 'object' && value !== null && !Array.isArray(value);

      // Only style sections may be updated: never id, workspace, appliedThemeTemplateId, etc.
      const allowedKeys = ['company', 'questions', 'mentions', 'moderator', 'gif', 'usernames'];
      const target = workspace.style as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(styleData)) {
        if (!allowedKeys.includes(key)) {
          continue;
        }
        const current = target[key];
        if (isPlainObject(current) && isPlainObject(value)) {
          target[key] = { ...current, ...value };
        } else {
          target[key] = value;
        }
      }

      // Clear theme tracking — manual workspace style change breaks the link
      workspace.style.appliedThemeTemplateId = null;
      return this.styleRepository.save(workspace.style);
    } else {
      // Create new style - initialize with institution's default style first
      const institution = await this.institutionRepository.findOne({
        where: { id: institutionId },
        relations: ['defaultStyle'],
      });

      if (!institution) {
        throw new NotFoundException(`Institution with ID ${institutionId} not found`);
      }

      // Start with institution's default style as base
      const baseStyle = institution.defaultStyle
        ? {
            company: { ...institution.defaultStyle.company },
            questions: { ...institution.defaultStyle.questions },
            mentions: { ...institution.defaultStyle.mentions },
            moderator: { ...institution.defaultStyle.moderator },
            gif: { ...(institution.defaultStyle.gif ?? { isEnabled: true }) },
            usernames: { ...(institution.defaultStyle.usernames ?? { isEnabled: true }) },
          }
        : null;

      if (!baseStyle) {
        throw new Error(
          `Institution ${institutionId} has no default style. Cannot create workspace style.`,
        );
      }

      // Merge provided data on top of base style
      const mergedStyleData = {
        company: {
          ...baseStyle.company,
          ...(styleData.company || {}),
        },
        questions: {
          ...baseStyle.questions,
          ...(styleData.questions || {}),
        },
        mentions: {
          ...baseStyle.mentions,
          ...(styleData.mentions || {}),
        },
        moderator: {
          ...baseStyle.moderator,
          ...(styleData.moderator || {}),
        },
        gif: {
          ...baseStyle.gif,
          ...(styleData.gif || {}),
        },
        usernames: {
          ...baseStyle.usernames,
          ...(styleData.usernames || {}),
        },
      };

      const newStyle = this.styleRepository.create({
        ...mergedStyleData,
        workspace,
      });
      const savedStyle = await this.styleRepository.save(newStyle);

      workspace.style = savedStyle;
      await this.workspaceRepository.save(workspace);

      return savedStyle;
    }
  }
}
