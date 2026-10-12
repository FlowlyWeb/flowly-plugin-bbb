import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InstitutionAccessGuard } from '../../common/guards/institution-access.guard';
import { FeatureGate } from '../../common/decorators/feature-gate.decorator';
import { BbbSettingsService } from '../services/bbb-settings.service';
import {
  CreateBbbSettingsDto,
  UpdateBbbSettingsDto,
  BbbSettingsResponseDto,
} from '../dto/bbb-settings.dto';
import { BbbSettings } from '../entities/bbb-settings.entity';

@ApiTags('BBB Settings')
@Controller('institutions/:institutionId/bbb-settings')
@UseGuards(JwtAuthGuard, InstitutionAccessGuard)
@ApiBearerAuth()
export class BbbSettingsController {
  constructor(private readonly bbbSettingsService: BbbSettingsService) {}

  @Post()
  @ApiOperation({ summary: 'Créer les paramètres BBB pour une institution' })
  @ApiResponse({
    status: 201,
    description: 'Paramètres BBB créés avec succès',
    type: BbbSettingsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides',
  })
  async create(
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
    @Body() createBbbSettingsDto: CreateBbbSettingsDto,
  ): Promise<BbbSettings> {
    return await this.bbbSettingsService.create(institutionId, createBbbSettingsDto);
  }

  @Get()
  @ApiOperation({ summary: "Récupérer les paramètres BBB d'une institution" })
  @ApiResponse({
    status: 200,
    description: 'Paramètres BBB récupérés avec succès',
    type: BbbSettingsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Paramètres BBB non trouvés',
  })
  async findByInstitution(
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
  ): Promise<BbbSettings | null> {
    return await this.bbbSettingsService.findByInstitution(institutionId);
  }

  @Put()
  @ApiOperation({ summary: "Mettre à jour les paramètres BBB d'une institution" })
  @ApiResponse({
    status: 200,
    description: 'Paramètres BBB mis à jour avec succès',
    type: BbbSettingsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Paramètres BBB non trouvés',
  })
  async update(
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
    @Body() updateBbbSettingsDto: UpdateBbbSettingsDto,
  ): Promise<BbbSettings> {
    return await this.bbbSettingsService.update(institutionId, updateBbbSettingsDto);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Supprimer les paramètres BBB d'une institution" })
  @ApiResponse({
    status: 204,
    description: 'Paramètres BBB supprimés avec succès',
  })
  @ApiResponse({
    status: 404,
    description: 'Paramètres BBB non trouvés',
  })
  async delete(@Param('institutionId', ParseUUIDPipe) institutionId: string): Promise<void> {
    await this.bbbSettingsService.delete(institutionId);
  }

  @Get('yaml')
  @FeatureGate('generateYAMLConfig')
  @ApiOperation({ summary: 'Générer le fichier YAML des paramètres BBB' })
  @ApiResponse({
    status: 200,
    description: 'Fichier YAML généré avec succès',
    content: {
      'application/x-yaml': {
        schema: {
          type: 'string',
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Feature not available in current pricing tier (requires Starter)',
  })
  @ApiResponse({
    status: 404,
    description: 'Paramètres BBB non trouvés',
  })
  async generateYaml(
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
    @Res() res: Response,
  ): Promise<void> {
    const yamlContent = await this.bbbSettingsService.generateYaml(institutionId);

    res.setHeader('Content-Type', 'application/x-yaml');
    res.setHeader('Content-Disposition', 'attachment; filename="bbb-settings.yml"');
    res.send(yamlContent);
  }

  @Get('yaml/preview')
  @FeatureGate('generateYAMLConfig')
  @ApiOperation({ summary: 'Prévisualiser le fichier YAML des paramètres BBB' })
  @ApiResponse({
    status: 200,
    description: 'Aperçu du YAML généré avec succès',
    content: {
      'text/plain': {
        schema: {
          type: 'string',
        },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Feature not available in current pricing tier (requires Starter)',
  })
  async previewYaml(
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
  ): Promise<{ yaml: string }> {
    const yamlContent = await this.bbbSettingsService.generateYaml(institutionId);
    return { yaml: yamlContent };
  }

  @Get('defaults')
  @ApiOperation({ summary: 'Récupérer les paramètres par défaut' })
  @ApiResponse({
    status: 200,
    description: 'Paramètres par défaut récupérés avec succès',
  })
  async getDefaults(): Promise<Partial<BbbSettings>> {
    return await this.bbbSettingsService.getDefaultSettings();
  }

  @Post('initialize')
  @ApiOperation({
    summary: 'Initialiser les paramètres BBB par défaut pour une institution existante',
  })
  @ApiResponse({
    status: 200,
    description: 'Paramètres BBB initialisés avec succès',
    type: BbbSettingsResponseDto,
  })
  async initializeDefaults(
    @Param('institutionId', ParseUUIDPipe) institutionId: string,
  ): Promise<BbbSettings> {
    return await this.bbbSettingsService.initializeDefaultsForExistingInstitution(institutionId);
  }
}
