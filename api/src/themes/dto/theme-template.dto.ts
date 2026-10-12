import {
  IsHexColor,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  CompanyThemeConfig,
  QuestionsThemeConfig,
  MentionsThemeConfig,
  ModeratorThemeConfig,
} from '../../institutions/dto/update-theme.dto';

/**
 * Company configuration for theme templates.
 * Same as CompanyThemeConfig but without logo field — templates never carry logos.
 */
export class TemplateCompanyConfig {
  @ApiProperty({
    description: 'Primary color in hexadecimal format',
    example: '#1E40AF',
  })
  @IsHexColor()
  @IsNotEmpty()
  primaryColor: string;

  @ApiProperty({
    description: 'Background configuration (solid or gradient)',
    example: { type: 'solid', color: '#0F172A' },
  })
  @IsNotEmpty()
  background: {
    type: 'solid' | 'gradient';
    color?: string;
    gradient?: {
      color1: string;
      color2: string;
      direction: string;
    };
  };
}

/**
 * Response DTO for theme template listings and details.
 */
export class ThemeTemplateResponseDto {
  @ApiProperty({ description: 'Unique identifier' })
  id: string;

  @ApiProperty({ description: 'URL-safe slug', example: 'professional-blue' })
  slug: string;

  @ApiProperty({ description: 'Display name', example: 'Bleu Professionnel' })
  name: string;

  @ApiProperty({ description: 'Short description' })
  description: string;

  @ApiProperty({
    description: 'Template category',
    example: 'predefined',
  })
  category: string;

  @ApiProperty({ description: 'Company style configuration (without logo/favicon)' })
  company: TemplateCompanyConfig;

  @ApiProperty({ description: 'Questions module configuration' })
  questions: {
    mainColor: string;
    backgroundColor: string;
    badge: { iconName: string; color: string } | null;
    keyword: string;
    isEnabled: boolean;
  };

  @ApiProperty({ description: 'Mentions module configuration' })
  mentions: {
    mainColor: string;
    backgroundColor: string;
    isEnabled: boolean;
  };

  @ApiProperty({ description: 'Moderator module configuration' })
  moderator: {
    mainColor: string;
    backgroundColor: string;
    badge: { iconName: string; color: string } | null;
    isEnabled: boolean;
  };

  @ApiProperty({ description: 'GIF module configuration' })
  gif: { isEnabled: boolean };

  @ApiProperty({ description: 'Display sort order' })
  sortOrder: number;
}

/**
 * DTO for applying a predefined theme template to an institution or workspace.
 */
export class ApplyThemeDto {
  @ApiProperty({
    description: 'ID of the theme template to apply',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  themeTemplateId: string;

  @ApiPropertyOptional({
    description: 'Target workspace ID. If omitted, applies to the institution default style.',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  @IsUUID()
  @IsOptional()
  workspaceId?: string;
}

/**
 * DTO for importing a theme from a JSON export.
 * Reuses the same sub-config classes as UpdateThemeDto for validation.
 */
export class ImportThemeDto {
  @ApiProperty({
    description: 'Display name for the imported theme',
    example: 'Mon thème personnalisé',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Company style configuration' })
  @ValidateNested()
  @Type(() => CompanyThemeConfig)
  @IsNotEmpty()
  company: CompanyThemeConfig;

  @ApiProperty({ description: 'Questions module configuration' })
  @ValidateNested()
  @Type(() => QuestionsThemeConfig)
  @IsNotEmpty()
  questions: QuestionsThemeConfig;

  @ApiProperty({ description: 'Mentions module configuration' })
  @ValidateNested()
  @Type(() => MentionsThemeConfig)
  @IsNotEmpty()
  mentions: MentionsThemeConfig;

  @ApiProperty({ description: 'Moderator module configuration' })
  @ValidateNested()
  @Type(() => ModeratorThemeConfig)
  @IsNotEmpty()
  moderator: ModeratorThemeConfig;

  @ApiPropertyOptional({
    description: 'Target workspace ID. If omitted, applies to the institution default style.',
  })
  @IsUUID()
  @IsOptional()
  workspaceId?: string;
}

/**
 * DTO for updating a custom theme template's metadata (name and/or description).
 * Only applicable to templates with `category === 'custom'`.
 */
export class UpdateThemeTemplateDto {
  @ApiPropertyOptional({
    description: 'New display name for the theme',
    example: 'Mon thème renommé',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'New description for the theme',
    example: 'Un thème sombre professionnel',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

/**
 * DTO for saving the current institution theme as a custom template in the library.
 */
export class SaveCurrentThemeDto {
  @ApiProperty({
    description: 'Display name for the saved theme',
    example: 'Mon thème personnalisé',
  })
  @IsString()
  @IsNotEmpty()
  name: string;
}
