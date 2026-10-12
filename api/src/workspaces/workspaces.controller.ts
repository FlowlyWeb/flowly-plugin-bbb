import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { UpdateWorkspaceStyleDto } from './dto/update-workspace-style.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { InstitutionAccessGuard } from '../common/guards/institution-access.guard';

/**
 * Controller for workspace management
 * Workspaces allow institutions to create sub-organizations with custom styling
 */
@ApiTags('Workspaces')
@Controller('institutions/:institutionId/workspaces')
@UseGuards(JwtAuthGuard, InstitutionAccessGuard)
@ApiBearerAuth()
export class WorkspacesController {
  private readonly logger = new Logger(WorkspacesController.name);

  constructor(private readonly workspacesService: WorkspacesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workspace' })
  @ApiParam({ name: 'institutionId', description: 'Institution ID' })
  @ApiResponse({ status: 201, description: 'Workspace created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Institution not found' })
  @ApiResponse({ status: 409, description: 'Workspace code already exists' })
  async create(
    @Param('institutionId') institutionId: string,
    @Body() createDto: CreateWorkspaceDto,
  ) {
    return this.workspacesService.create(institutionId, createDto);
  }

  @Post(':id/duplicate')
  @ApiOperation({
    summary: 'Duplicate an existing workspace',
    description:
      'Creates a copy of a workspace with a new name and code. The workspace style is also duplicated if it exists.',
  })
  @ApiParam({ name: 'institutionId', description: 'Institution ID' })
  @ApiParam({ name: 'id', description: 'Source workspace ID to duplicate' })
  @ApiResponse({ status: 201, description: 'Workspace duplicated successfully' })
  @ApiResponse({ status: 404, description: 'Source workspace not found' })
  @ApiResponse({ status: 409, description: 'Workspace code already exists' })
  @ApiResponse({ status: 403, description: 'Quota limit reached' })
  async duplicate(
    @Param('institutionId') institutionId: string,
    @Param('id') sourceWorkspaceId: string,
    @Body() createDto: CreateWorkspaceDto,
  ) {
    return this.workspacesService.duplicate(institutionId, sourceWorkspaceId, createDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all workspaces for an institution' })
  @ApiParam({ name: 'institutionId', description: 'Institution ID' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Include inactive workspaces',
    type: Boolean,
  })
  @ApiResponse({ status: 200, description: 'Workspaces retrieved successfully' })
  async findAll(
    @Param('institutionId') institutionId: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const includeInactiveFlag = includeInactive === 'true';
    return this.workspacesService.findAll(institutionId, includeInactiveFlag);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific workspace by ID' })
  @ApiParam({ name: 'institutionId', description: 'Institution ID' })
  @ApiParam({ name: 'id', description: 'Workspace ID' })
  @ApiResponse({ status: 200, description: 'Workspace retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async findOne(@Param('institutionId') institutionId: string, @Param('id') id: string) {
    return this.workspacesService.findOne(id, institutionId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a workspace' })
  @ApiParam({ name: 'institutionId', description: 'Institution ID' })
  @ApiParam({ name: 'id', description: 'Workspace ID' })
  @ApiResponse({ status: 200, description: 'Workspace updated successfully' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  @ApiResponse({ status: 409, description: 'Workspace code already exists' })
  async update(
    @Param('institutionId') institutionId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateWorkspaceDto,
  ) {
    return this.workspacesService.update(id, institutionId, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a workspace' })
  @ApiParam({ name: 'institutionId', description: 'Institution ID' })
  @ApiParam({ name: 'id', description: 'Workspace ID' })
  @ApiResponse({ status: 204, description: 'Workspace deleted successfully' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  @ApiResponse({ status: 500, description: 'Internal server error during deletion' })
  async remove(@Param('institutionId') institutionId: string, @Param('id') id: string) {
    try {
      this.logger.log(`Attempting to delete workspace ${id} from institution ${institutionId}`);
      await this.workspacesService.remove(id, institutionId);
      this.logger.log(`Successfully deleted workspace ${id} from institution ${institutionId}`);
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      this.logger.error(
        `Failed to delete workspace ${id} from institution ${institutionId}`,
        err.stack,
        {
          workspaceId: id,
          institutionId,
          errorName: err.name,
          errorMessage: err.message,
        },
      );

      // Re-throw the error to be handled by the global exception filter
      // If it's already an HTTP exception, let it pass through
      // Otherwise, wrap it in InternalServerErrorException
      if (err.status) {
        throw error;
      }

      throw new InternalServerErrorException(`Failed to delete workspace: ${err.message}`);
    }
  }

  @Post(':id/styles')
  @ApiOperation({
    summary: 'Create or update workspace style',
    description:
      'Creates a new workspace style initialized with institution defaults, or updates an existing style. When creating a new style, all required fields are inherited from the institution default style.',
  })
  @ApiParam({ name: 'institutionId', description: 'Institution ID' })
  @ApiParam({ name: 'id', description: 'Workspace ID' })
  @ApiResponse({ status: 200, description: 'Style updated successfully' })
  @ApiResponse({ status: 404, description: 'Workspace or institution not found' })
  @ApiResponse({ status: 400, description: 'Invalid style data' })
  async updateStyle(
    @Param('institutionId') institutionId: string,
    @Param('id') id: string,
    @Body() styleData: UpdateWorkspaceStyleDto,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.workspacesService.createOrUpdateStyle(id, institutionId, styleData as any);
  }

  @Post(':id/styles/reset')
  @ApiOperation({
    summary: 'Reset workspace style to institution defaults',
    description:
      'Removes custom workspace styling and reverts to institution default style. Available for all pricing tiers without restrictions.',
  })
  @ApiParam({ name: 'institutionId', description: 'Institution ID' })
  @ApiParam({ name: 'id', description: 'Workspace ID' })
  @ApiResponse({ status: 200, description: 'Workspace style reset successfully' })
  @ApiResponse({ status: 404, description: 'Workspace or institution not found' })
  async resetStyle(@Param('institutionId') institutionId: string, @Param('id') id: string) {
    return this.workspacesService.resetStyle(id, institutionId);
  }
}
