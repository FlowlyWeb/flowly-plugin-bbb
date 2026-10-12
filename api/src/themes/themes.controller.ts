import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FeatureGate } from '../common/decorators/feature-gate.decorator';
import { ThemesService } from './themes.service';
import {
  ApplyThemeDto,
  ImportThemeDto,
  SaveCurrentThemeDto,
  ThemeTemplateResponseDto,
  UpdateThemeTemplateDto,
} from './dto/theme-template.dto';

/**
 * Controller for the Theme Library feature.
 *
 * Read endpoints (findAll, findById) are available to all authenticated users.
 * Write endpoints (apply, import, export, save, delete, update, sync) require
 * the `completeTheme` feature (Pro tier or higher).
 * Route ordering: static routes (`export/current`) are declared before
 * parameterised routes (`:id`) to avoid NestJS routing conflicts.
 */
@ApiTags('Themes')
@Controller('themes')
export class ThemesController {
  constructor(private readonly themesService: ThemesService) {}

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({
    summary: 'List all theme templates',
    description:
      'Returns all active predefined theme templates sorted by display order. Available to all plans.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of theme templates',
    type: [ThemeTemplateResponseDto],
  })
  async findAll(@Request() req) {
    return this.themesService.findAll(req.user.institutionId);
  }

  @ApiBearerAuth('JWT-auth')
  @FeatureGate('completeTheme')
  @Get('export/current')
  @ApiOperation({
    summary: 'Export current institution theme as JSON',
    description:
      'Exports the current style of the authenticated institution without logo/favicon binary data.',
  })
  @ApiResponse({ status: 200, description: 'Current theme data' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Feature not available in current pricing tier',
  })
  async exportCurrent(@Request() req) {
    return this.themesService.exportCurrentTheme(req.user.institutionId);
  }

  @ApiBearerAuth('JWT-auth')
  @FeatureGate('completeTheme')
  @Post('save')
  @ApiOperation({
    summary: 'Save current theme as a custom template',
    description:
      'Saves the current institution style as a reusable custom template in the theme library.',
  })
  @ApiResponse({
    status: 201,
    description: 'Theme template saved',
    type: ThemeTemplateResponseDto,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Feature not available in current pricing tier',
  })
  async saveCurrentTheme(@Request() req, @Body() dto: SaveCurrentThemeDto) {
    return this.themesService.saveCurrentAsTemplate(dto, req.user.institutionId, req.user.userId);
  }

  @ApiBearerAuth('JWT-auth')
  @FeatureGate('completeTheme')
  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a custom theme template',
    description: 'Soft-deletes a custom theme template. Predefined themes cannot be deleted.',
  })
  @ApiResponse({ status: 200, description: 'Theme template deleted' })
  @ApiResponse({ status: 403, description: 'Forbidden - predefined theme or feature unavailable' })
  @ApiResponse({ status: 404, description: 'Theme template not found' })
  async deleteTemplate(@Param('id') id: string, @Request() req) {
    await this.themesService.deleteCustomTemplate(id, req.user.institutionId);
    return { message: 'Theme template deleted' };
  }

  @ApiBearerAuth('JWT-auth')
  @FeatureGate('completeTheme')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a custom theme template',
    description:
      'Updates the name and/or description of a custom theme template. Predefined themes cannot be edited.',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated theme template',
    type: ThemeTemplateResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - predefined theme or feature unavailable' })
  @ApiResponse({ status: 404, description: 'Theme template not found' })
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateThemeTemplateDto,
    @Request() req,
  ) {
    return this.themesService.updateCustomTemplate(id, dto, req.user.institutionId);
  }

  @ApiBearerAuth('JWT-auth')
  @FeatureGate('completeTheme')
  @Post(':id/sync')
  @ApiOperation({
    summary: 'Sync current institution style into a custom template',
    description:
      'Copies the current institution style (colors, modules) back into a custom theme template. ' +
      'Image backgrounds are converted to solid fallback. Predefined themes cannot be synced.',
  })
  @ApiResponse({
    status: 200,
    description: 'Template synced with current style',
    type: ThemeTemplateResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden - predefined theme or feature unavailable' })
  @ApiResponse({ status: 404, description: 'Theme template or institution not found' })
  async syncToTemplate(@Request() req, @Param('id') id: string) {
    return this.themesService.syncStyleToTemplate(id, req.user.institutionId);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @ApiOperation({
    summary: 'Get a single theme template',
    description: 'Returns the details of a specific theme template by ID. Available to all plans.',
  })
  @ApiResponse({
    status: 200,
    description: 'Theme template details',
    type: ThemeTemplateResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Theme template not found' })
  async findById(@Param('id') id: string, @Request() req) {
    return this.themesService.findById(id, req.user.institutionId);
  }

  @ApiBearerAuth('JWT-auth')
  @FeatureGate('completeTheme')
  @Post('apply')
  @ApiOperation({
    summary: 'Apply a theme template',
    description:
      'Applies a predefined theme template to the institution or a specific workspace. ' +
      'Logo and favicon are preserved from the current style.',
  })
  @ApiResponse({ status: 200, description: 'Theme applied successfully' })
  @ApiResponse({ status: 404, description: 'Theme template or target not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Feature not available in current pricing tier',
  })
  async apply(@Request() req, @Body() dto: ApplyThemeDto) {
    if (dto.workspaceId) {
      return this.themesService.applyToWorkspace(
        dto.themeTemplateId,
        req.user.institutionId,
        dto.workspaceId,
      );
    }
    return this.themesService.applyToInstitution(dto.themeTemplateId, req.user.institutionId);
  }

  @ApiBearerAuth('JWT-auth')
  @FeatureGate('completeTheme')
  @Post('import')
  @ApiOperation({
    summary: 'Import and apply a theme from JSON',
    description:
      'Validates an imported JSON theme definition and applies it to the institution ' +
      'or a specific workspace. Logo and favicon are preserved.',
  })
  @ApiResponse({ status: 200, description: 'Theme imported and applied' })
  @ApiResponse({
    status: 400,
    description: 'Invalid theme JSON structure',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Feature not available in current pricing tier',
  })
  async importTheme(@Request() req, @Body() dto: ImportThemeDto) {
    return this.themesService.importAndApply(dto, req.user.institutionId);
  }
}
