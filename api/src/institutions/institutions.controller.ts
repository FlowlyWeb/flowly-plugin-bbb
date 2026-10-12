import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Headers,
  UseGuards,
  Request,
  Query,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Param,
} from '@nestjs/common';
import { InstitutionsService } from './institutions.service';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { JwtOrApiKeyGuard } from '../common/guards/jwt-or-apikey.guard';
import {
  assertInstitutionAccess,
  assertPrivilegedCaller,
  isPrivilegedCaller,
} from '../common/guards/institution-access.guard';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import {
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiExtraModels,
} from '@nestjs/swagger';
import { UnauthorizedResponse, RateLimitResponse } from '../common/swagger/error-response';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { UpdateLogoDto } from './dto/update-logo.dto';
import { UpdateFaviconDto } from './dto/update-favicon.dto';
import { UpdateColorsDto } from './dto/update-colors.dto';
import { UpdateModulesDto } from './dto/update-modules.dto';
import { UpdateInstitutionDto } from './dto/update-institution.dto';
import { StylesResponseDto } from './dto/get-style-response.dto';
import { InstitutionFeaturesDto } from './dto/institution-features.dto';
import { Public } from '../common/decorators/public.decorator';
import { FeatureGate } from '../common/decorators/feature-gate.decorator';
import { FeaturesService } from '../common/services/features.service';
import { ConfigService } from '@nestjs/config';
import { Institution } from './entities/institution.entity';
import { Style } from './entities/style.entity';

@ApiTags('Institutions')
@Controller('institutions')
@ApiExtraModels(CreateInstitutionDto)
export class InstitutionsController {
  private readonly logger = new Logger(InstitutionsController.name);

  constructor(
    private readonly institutionsService: InstitutionsService,
    private readonly workspacesService: WorkspacesService,
    private readonly featuresService: FeaturesService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Helper method to clean legacy badge format (string emojis) to prevent crashes
   * Converts string badges to null
   */
  private cleanLegacyBadges(style: Style) {
    const questions = { ...style.questions };
    const moderator = { ...style.moderator };

    if (questions.badge && typeof questions.badge === 'string') {
      this.logger.warn(`Cleaning legacy questions badge: "${questions.badge}"`);
      questions.badge = null;
    }
    if (moderator.badge && typeof moderator.badge === 'string') {
      this.logger.warn(`Cleaning legacy moderator badge: "${moderator.badge}"`);
      moderator.badge = null;
    }

    return {
      ...style,
      questions,
      moderator,
    };
  }

  /**
   * Applies pricing tier restrictions to the styles response.
   * In on-premise mode, returns the response unchanged.
   * In SaaS mode, forces isEnabled to false for modules the tier does not allow.
   */
  private applyTierRestrictions(
    response: StylesResponseDto,
    institution: Institution,
  ): StylesResponseDto {
    const deploymentMode = this.configService.get<string>('deploymentMode', 'saas');
    if (deploymentMode === 'onpremise') {
      return response;
    }

    const result = { ...response };

    if (!this.featuresService.hasFeature('gifModule', institution.currentPricingTier)) {
      result.gif = { isEnabled: false };
    }
    if (!this.featuresService.hasFeature('usernamesModule', institution.currentPricingTier)) {
      result.usernames = { isEnabled: false };
    }

    return result;
  }

  @UseGuards(JwtOrApiKeyGuard)
  @Get()
  @ApiOperation({
    summary: 'Get all institutions (Protected)',
    description:
      'Retrieves all institutions with admin emails. Restricted to internal API Key or super admin callers. Used by flowly-core for admin dashboard.',
  })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'Internal API Key for inter-service authentication',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved all institutions with emails',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
          name: { type: 'string', example: 'My School' },
          domain: { type: 'string', example: 'myschool.com' },
          address: { type: 'string', example: '123 Main St, City, Country' },
          vatNumber: { type: 'string', example: 'FR12345678901', nullable: true },
          geoRegion: { type: 'string', example: 'france' },
          isActive: { type: 'boolean', example: true },
          adminEmail: { type: 'string', example: 'admin@myschool.com', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing API Key',
  })
  async findAll(@Request() req) {
    assertPrivilegedCaller(req);

    const institutions = await this.institutionsService.findAllWithAdminEmails();
    return institutions.map((institution) => ({
      id: institution.id,
      name: institution.name,
      domain: institution.domain,
      address: institution.address,
      vatNumber: institution.vatNumber,
      geoRegion: institution.geoRegion,
      isActive: institution.isActive,
      adminEmail: institution.adminEmail,
      createdAt: institution.createdAt,
      updatedAt: institution.updatedAt,
    }));
  }

  @UseGuards(JwtOrApiKeyGuard)
  @ApiBearerAuth('JWT-auth')
  @Post()
  @ApiOperation({
    summary: 'Create a new institution (internal API Key or super admin only)',
    description: `
            Creates a new institution with default styling configuration.
            This endpoint is typically called from the payment processing webhook.

            Important notes:
            - This endpoint is public but will be secured by Mollie webhook verification
            - Institution creation is only completed after payment verification
            - Default styles are automatically generated
            - An admin user account is created for the institution

            Rate limiting:
            - Limited to 5 requests per second to prevent abuse
        `,
  })
  @ApiBody({
    type: CreateInstitutionDto,
    description: 'Institution creation data',
    examples: {
      'Standard Institution': {
        value: {
          name: 'My School',
          email: 'contact@myschool.com',
          domain: 'myschool.com',
        },
        summary: 'Basic institution creation',
      },
      'With Custom Domain': {
        value: {
          name: 'University XYZ',
          email: 'admin@xyz.edu',
          domain: 'xyz.edu',
        },
        summary: 'Educational institution with custom domain',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Institution successfully created',
    schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          example: '123e4567-e89b-12d3-a456-426614174000',
          description: 'Unique identifier of the created institution',
        },
        name: {
          type: 'string',
          example: 'My School',
          description: 'Name of the institution',
        },
        email: {
          type: 'string',
          example: 'contact@myschool.com',
          description: 'Contact email for the institution',
        },
        domain: {
          type: 'string',
          example: 'myschool.com',
          description: 'Domain associated with the institution',
        },
        styles: {
          type: 'object',
          description: 'Default styling configuration',
          properties: {
            company: {
              type: 'object',
              properties: {
                primaryColor: { type: 'string', example: '#0F70D7' },
                background: {
                  type: 'object',
                  example: { type: 'solid', color: '#06172A' },
                },
              },
            },
            questions: {
              type: 'object',
              properties: {
                mainColor: { type: 'string', example: '#FF9800' },
                backgroundColor: { type: 'string', example: '#FFF3E0' },
              },
            },
            mentions: {
              type: 'object',
              properties: {
                mainColor: { type: 'string', example: '#2196F3' },
                backgroundColor: { type: 'string', example: '#E3F2FD' },
              },
            },
            moderator: {
              type: 'object',
              properties: {
                mainColor: { type: 'string', example: '#F44336' },
                backgroundColor: { type: 'string', example: '#F443361A' },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse(UnauthorizedResponse)
  @ApiResponse(RateLimitResponse)
  @ApiResponse({
    status: 400,
    description: 'Invalid input data provided',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: {
          type: 'array',
          items: { type: 'string' },
          example: ['email must be a valid email', 'domain must be a valid domain name'],
        },
        error: { type: 'string', example: 'Bad Request' },
      },
    },
  })
  async create(@Request() req, @Body() createInstitutionDto: CreateInstitutionDto) {
    assertPrivilegedCaller(req);

    const institution = await this.institutionsService.create(createInstitutionDto);
    return {
      id: institution.id,
      name: institution.name,
      domain: institution.domain,
      defaultStyle: institution.defaultStyle,
    };
  }

  @ApiBearerAuth('JWT-auth')
  @FeatureGate('customizeLogo')
  @Post('styles/logo')
  @ApiOperation({
    summary: 'Update institution logo',
    description:
      'Updates the institution logo using base64 encoded image data. Requires customizeLogo feature (available in all tiers).',
  })
  @ApiResponse({
    status: 200,
    description: 'Logo successfully updated',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Feature not available in current pricing tier',
  })
  async updateLogo(@Request() req, @Body() updateLogoDto: UpdateLogoDto) {
    return this.institutionsService.updateLogo(req.user.institutionId, updateLogoDto);
  }

  @ApiBearerAuth('JWT-auth')
  @FeatureGate('customizeLogo')
  @Post('styles/favicon')
  @ApiOperation({
    summary: 'Update institution favicon',
    description:
      'Updates the institution favicon using base64 encoded image (PNG/ICO/SVG, max 100KB)',
  })
  @ApiResponse({
    status: 200,
    description: 'Favicon successfully updated',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid favicon format or size',
  })
  @ApiResponse({
    status: 403,
    description: 'Feature not available in current pricing tier',
  })
  async updateFavicon(@Request() req, @Body() updateFaviconDto: UpdateFaviconDto) {
    return this.institutionsService.updateFavicon(req.user.institutionId, updateFaviconDto);
  }

  @ApiBearerAuth('JWT-auth')
  @FeatureGate('customizeColors')
  @Post('styles/colors')
  @ApiOperation({
    summary: 'Update institution company colors',
    description:
      'Updates only the primary and secondary company colors. Requires customizeColors feature (Starter tier or higher).',
  })
  @ApiBody({
    type: UpdateColorsDto,
    description: 'Company colors to update',
    examples: {
      'Update solid background': {
        value: {
          primaryColor: '#0F70D7',
          background: { type: 'solid', color: '#06172A' },
        },
        summary: 'Update primary color and solid background',
      },
      'Update gradient background': {
        value: {
          background: {
            type: 'gradient',
            gradient: {
              color1: '#0F70D7',
              color2: '#06172A',
              direction: 'to-bottom',
            },
          },
        },
        summary: 'Update to gradient background',
      },
      'Update primary only': {
        value: {
          primaryColor: '#FF0000',
        },
        summary: 'Update only primary color',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Colors successfully updated',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Feature not available in current pricing tier (requires Starter)',
  })
  async updateColors(@Request() req, @Body() updateColorsDto: UpdateColorsDto) {
    return this.institutionsService.updateColors(req.user.institutionId, updateColorsDto);
  }

  @ApiBearerAuth('JWT-auth')
  @FeatureGate('completeTheme')
  @Post('styles/theme')
  @ApiOperation({
    summary: 'Update institution theme',
    description:
      'Updates the institution theme including colors and badges. Requires completeTheme feature (Pro tier or higher).',
  })
  @ApiResponse({
    status: 200,
    description: 'Theme successfully updated',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Feature not available in current pricing tier (requires Pro)',
  })
  async updateTheme(@Request() req, @Body() updateThemeDto: UpdateThemeDto) {
    return this.institutionsService.updateTheme(req.user.institutionId, updateThemeDto);
  }

  @ApiBearerAuth('JWT-auth')
  @FeatureGate('completeTheme')
  @Post('styles/modules')
  @ApiOperation({
    summary: 'Update module configuration',
    description:
      'Enable or disable specific modules for the institution. Requires completeTheme feature (Pro tier or higher).',
  })
  @ApiResponse({
    status: 200,
    description: 'Module configuration successfully updated',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Feature not available in current pricing tier (requires Pro)',
  })
  async updateModules(@Request() req, @Body() updateModulesDto: UpdateModulesDto) {
    return this.institutionsService.updateModules(req.user.institutionId, updateModulesDto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('styles/reset')
  @ApiOperation({
    summary: 'Reset institution styles to default values',
    description:
      'Resets all styling configuration to default values. Available for all pricing tiers without restrictions.',
  })
  @ApiResponse({
    status: 200,
    description: 'Styles successfully reset to defaults',
    type: StylesResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  async resetStyles(@Request() req) {
    return this.institutionsService.resetStyles(req.user.institutionId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Post('styles/unlink-theme')
  @ApiOperation({
    summary: 'Unlink the applied theme template from the institution style',
    description:
      'Removes the link between the institution style and its applied theme template. The style itself is not modified.',
  })
  @ApiResponse({
    status: 200,
    description: 'Theme template unlinked',
    type: StylesResponseDto,
  })
  async unlinkTheme(@Request() req) {
    return this.institutionsService.unlinkTheme(req.user.institutionId);
  }

  @Public()
  @Get('styles')
  @ApiOperation({
    summary: 'Get institution or workspace styles by origin',
    description:
      "Retrieves styling configuration for the institution matching the request's origin domain. If workspaceCode is provided, returns workspace-specific styles with fallback to institution default styles.",
  })
  @ApiQuery({
    name: 'workspaceCode',
    required: false,
    description: 'Optional workspace code (e.g., ACAD_BRETAGNE) to get workspace-specific styles',
    example: 'ACAD_BRETAGNE',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved styles',
    type: StylesResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Origin header is missing',
  })
  @ApiResponse({
    status: 404,
    description: 'Institution not found for this domain',
  })
  async getStyles(
    @Headers('origin') origin: string,
    @Query('workspaceCode') workspaceCode?: string,
  ) {
    if (!origin) {
      throw new BadRequestException('Origin header is required');
    }

    const institution = await this.institutionsService.findByOrigin(origin);

    if (!institution) {
      throw new NotFoundException('Institution not found for this domain');
    }

    // If workspaceCode is provided and not empty, try to get workspace-specific styles
    if (workspaceCode && workspaceCode.trim() !== '') {
      const workspace = await this.workspacesService.findByCode(workspaceCode, institution.id);

      if (workspace?.style) {
        // Return workspace-specific styles (with legacy badge cleanup)
        const cleaned = this.cleanLegacyBadges(workspace.style);
        const result: StylesResponseDto = {
          id: workspace.style.id,
          name: `${institution.name} - ${workspace.name}`,
          company: workspace.style.company,
          questions: cleaned.questions,
          mentions: workspace.style.mentions,
          moderator: cleaned.moderator,
          gif: workspace.style.gif ?? { isEnabled: true },
          usernames: workspace.style.usernames ?? { isEnabled: true },
          appliedThemeTemplateId: workspace.style.appliedThemeTemplateId ?? null,
        };
        return this.applyTierRestrictions(result, institution);
      }
    }

    // Return institution's default style (with legacy badge cleanup)
    if (!institution.defaultStyle) {
      throw new NotFoundException('No default style found for this institution');
    }

    const cleaned = this.cleanLegacyBadges(institution.defaultStyle);
    const result: StylesResponseDto = {
      id: institution.defaultStyle.id,
      name: institution.name,
      company: institution.defaultStyle.company,
      questions: cleaned.questions,
      mentions: institution.defaultStyle.mentions,
      moderator: cleaned.moderator,
      gif: institution.defaultStyle.gif ?? { isEnabled: true },
      usernames: institution.defaultStyle.usernames ?? { isEnabled: true },
      appliedThemeTemplateId: institution.defaultStyle.appliedThemeTemplateId ?? null,
    };
    return this.applyTierRestrictions(result, institution);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('styles/me')
  @ApiOperation({
    summary: "Get authenticated user's institution styles",
    description: "Retrieves styling configuration for the authenticated user's institution",
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved institution styles',
    type: StylesResponseDto,
  })
  async getMyStyles(@Request() req) {
    const user = req.user;

    const institution = await this.institutionsService.findById(user.institutionId);

    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    // Clean legacy badge format (string emojis) to prevent frontend crashes
    const cleaned = this.cleanLegacyBadges(institution.defaultStyle);

    return {
      id: institution.id,
      name: institution.name,
      company: institution.defaultStyle.company,
      questions: cleaned.questions,
      mentions: institution.defaultStyle.mentions,
      moderator: cleaned.moderator,
      gif: institution.defaultStyle.gif ?? { isEnabled: true },
      usernames: institution.defaultStyle.usernames ?? { isEnabled: true },
      appliedThemeTemplateId: institution.defaultStyle.appliedThemeTemplateId ?? null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Get('features')
  @ApiOperation({
    summary: 'Get institution features and quotas',
    description: `
            Retrieves feature access control information for the authenticated user's institution.
            Returns the current pricing tier, quota usage (servers/sub-orgs), and available feature flags.

            In on-premise mode, all features are enabled and quotas are unlimited.
            In SaaS mode, features and quotas depend on the institution's pricing tier.
        `,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved institution features',
    type: InstitutionFeaturesDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing JWT token',
  })
  @ApiResponse({
    status: 404,
    description: 'Institution not found',
  })
  async getFeatures(@Request() req): Promise<InstitutionFeaturesDto> {
    return this.institutionsService.getFeaturesForInstitution(req.user.institutionId);
  }

  @UseGuards(JwtOrApiKeyGuard)
  @Get('domain/:domain')
  @ApiOperation({
    summary: 'Get institution by domain (Protected)',
    description: `
            Retrieves institution details by domain name.
            Includes admin email (first active user) for email notifications.
            This endpoint is used by flowly-core for sending invoices and notifications.
            Requires the internal API Key, a super admin JWT, or a JWT of the same institution.
        `,
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved institution details',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        name: { type: 'string', example: 'My School' },
        domain: { type: 'string', example: 'myschool.com' },
        address: { type: 'string', example: '123 Main St, City, Country' },
        vatNumber: { type: 'string', example: 'FR12345678901', nullable: true },
        isActive: { type: 'boolean', example: true },
        adminEmail: { type: 'string', example: 'admin@myschool.com', nullable: true },
        geoRegion: { type: 'string', example: 'france' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Institution not found',
  })
  async getInstitutionByDomain(@Request() req, @Param('domain') domain: string) {
    const institution = await this.institutionsService.findByDomain(domain);

    if (!institution) {
      throw new NotFoundException(`Institution with domain ${domain} not found`);
    }

    assertInstitutionAccess(req, institution.id);

    return {
      id: institution.id,
      name: institution.name,
      domain: institution.domain,
      address: institution.address,
      vatNumber: institution.vatNumber,
      isActive: institution.isActive,
      adminEmail: institution.adminEmail,
      geoRegion: institution.geoRegion,
      createdAt: institution.createdAt,
      updatedAt: institution.updatedAt,
    };
  }

  @UseGuards(JwtOrApiKeyGuard)
  @Patch(':id')
  @ApiOperation({
    summary: 'Update institution properties',
    description: `
            Updates institution properties such as pricing tier and quotas.
            This endpoint is called by flowly-core to synchronize subscription/trial status.

            Protected by API Key authentication for inter-service communication.
            Users of the institution may only update its profile fields (name, domain, address,
            VAT number, region); pricing tier, quotas and activation are reserved to internal callers.
        `,
  })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'Internal API Key for inter-service authentication',
    required: true,
  })
  @ApiBody({
    type: UpdateInstitutionDto,
    description: 'Institution properties to update',
    examples: {
      'Update to Pro tier': {
        value: {
          currentPricingTier: 'pro',
          quotaServerLimit: 10,
          quotaSubOrgLimit: 3,
        },
        summary: 'Upgrade institution to Pro tier with new quotas',
      },
      'Update quotas only': {
        value: {
          quotaServerLimit: 5,
          quotaSubOrgLimit: 1,
        },
        summary: 'Update only quota limits',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Institution successfully updated',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        name: { type: 'string', example: 'My School' },
        currentPricingTier: { type: 'string', example: 'pro' },
        quotaServerLimit: { type: 'number', example: 10 },
        quotaSubOrgLimit: { type: 'number', example: 3 },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Invalid or missing API Key',
  })
  @ApiResponse({
    status: 404,
    description: 'Institution not found',
  })
  async updateInstitution(
    @Request() req,
    @Param('id') id: string,
    @Body() updateDto: UpdateInstitutionDto,
  ) {
    assertInstitutionAccess(req, id);

    if (!isPrivilegedCaller(req)) {
      const privilegedFields: (keyof UpdateInstitutionDto)[] = [
        'currentPricingTier',
        'quotaServerLimit',
        'quotaSubOrgLimit',
        'isActive',
      ];
      if (privilegedFields.some((field) => updateDto[field] !== undefined)) {
        throw new ForbiddenException('Pricing tier, quotas and activation cannot be changed');
      }
    }

    const institution = await this.institutionsService.update(id, updateDto);

    return {
      id: institution.id,
      name: institution.name,
      domain: institution.domain,
      currentPricingTier: institution.currentPricingTier,
      quotaServerLimit: institution.quotaServerLimit,
      quotaSubOrgLimit: institution.quotaSubOrgLimit,
      quotaServersUsed: institution.quotaServersUsed,
      quotaSubOrgsUsed: institution.quotaSubOrgsUsed,
      updatedAt: institution.updatedAt,
    };
  }

  @UseGuards(JwtOrApiKeyGuard)
  @Get(':id')
  @ApiOperation({
    summary: 'Get institution details by ID (Protected)',
    description:
      'Retrieves detailed information about an institution by its ID. Requires the internal API Key (flowly-core), a super admin JWT, or a JWT of the same institution.',
  })
  @ApiResponse({
    status: 200,
    description: 'Successfully retrieved institution details',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        name: { type: 'string', example: 'My School' },
        domain: { type: 'string', example: 'myschool.com' },
        address: { type: 'string', example: '123 Main St, City, Country' },
        vatNumber: { type: 'string', example: 'FR12345678901', nullable: true },
        isActive: { type: 'boolean', example: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Institution not found',
  })
  async getInstitutionById(@Request() req, @Param('id') id: string) {
    assertInstitutionAccess(req, id);

    const institution = await this.institutionsService.findById(id);

    if (!institution) {
      throw new NotFoundException('Institution not found');
    }

    return {
      id: institution.id,
      name: institution.name,
      domain: institution.domain,
      address: institution.address,
      vatNumber: institution.vatNumber,
      isActive: institution.isActive,
      createdAt: institution.createdAt,
      updatedAt: institution.updatedAt,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete institution',
    description:
      'Permanently deletes an institution and all related data. This action cannot be undone.',
  })
  @ApiResponse({
    status: 200,
    description: 'Institution deleted successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Institution deleted successfully' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Institution not found',
  })
  async deleteInstitution(@Request() req, @Param('id') id: string) {
    assertInstitutionAccess(req, id);

    await this.institutionsService.remove(id);
    return {
      success: true,
      message: 'Institution deleted successfully',
    };
  }
}
