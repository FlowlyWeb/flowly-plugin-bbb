import {
  IsBoolean,
  IsHexColor,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { BackgroundConfig } from './update-colors.dto';

// Badge configuration class
export class BadgeConfig {
  @ApiProperty({
    description: 'Font Awesome icon name (without "fa-" prefix)',
    example: 'question',
  })
  @IsString()
  @IsNotEmpty()
  iconName: string;

  @ApiProperty({
    description: 'Badge color in hexadecimal format',
    example: '#FF9800',
  })
  @IsHexColor()
  @IsNotEmpty()
  color: string;
}

// Company theme configuration class
export class CompanyThemeConfig {
  @ApiProperty({
    description: 'Primary color in hexadecimal format',
    example: '#FF0000',
  })
  @IsHexColor()
  @IsNotEmpty()
  primaryColor: string;

  @ApiProperty({
    description: 'Background configuration (solid color, gradient, or image)',
    example: { type: 'solid', color: '#00FF00' },
  })
  @ValidateNested()
  @Type(() => BackgroundConfig)
  @IsNotEmpty()
  background: BackgroundConfig;

  @ApiProperty({
    description: 'Logo as base64 data URL, or null to remove it',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  logo?: string | null;
}

// Questions theme configuration class
export class QuestionsThemeConfig {
  @ApiProperty({
    description: 'Main color in hexadecimal format',
    example: '#0000FF',
  })
  @IsHexColor()
  @IsNotEmpty()
  mainColor: string;

  @ApiProperty({
    description: 'Background color in hexadecimal format',
    example: '#F0F0F0',
  })
  @IsHexColor()
  @IsNotEmpty()
  backgroundColor: string;

  @ApiProperty({
    description: 'Custom trigger for question module (e.g., "@question", "@ask")',
    example: '@question',
  })
  @IsString()
  @IsNotEmpty()
  keyword: string;

  @ApiProperty({
    description: 'Badge configuration with Font Awesome icon and color',
    required: false,
    nullable: true,
  })
  @ValidateNested()
  @Type(() => BadgeConfig)
  @IsOptional()
  badge?: BadgeConfig | null;

  @ApiProperty({
    description: 'Module enabled state (ignored in this endpoint, use /update-modules instead)',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}

// Mentions theme configuration class
export class MentionsThemeConfig {
  @ApiProperty({
    description: 'Main color in hexadecimal format',
    example: '#FF00FF',
  })
  @IsHexColor()
  @IsNotEmpty()
  mainColor: string;

  @ApiProperty({
    description: 'Background color in hexadecimal format',
    example: '#E0E0E0',
  })
  @IsHexColor()
  @IsNotEmpty()
  backgroundColor: string;

  @ApiProperty({
    description: 'Module enabled state (ignored in this endpoint, use /update-modules instead)',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}

// Moderator theme configuration class
export class ModeratorThemeConfig {
  @ApiProperty({
    description: 'Main color in hexadecimal format',
    example: '#FFA500',
  })
  @IsHexColor()
  @IsNotEmpty()
  mainColor: string;

  @ApiProperty({
    description: 'Background color in hexadecimal format',
    example: '#FFEFD5',
  })
  @IsHexColor()
  @IsNotEmpty()
  backgroundColor: string;

  @ApiProperty({
    description: 'Badge configuration with Font Awesome icon and color',
    required: false,
    nullable: true,
  })
  @ValidateNested()
  @Type(() => BadgeConfig)
  @IsOptional()
  badge?: BadgeConfig | null;

  @ApiProperty({
    description: 'Module enabled state (ignored in this endpoint, use /update-modules instead)',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  isEnabled?: boolean;
}

// Main UpdateThemeDto class
export class UpdateThemeDto {
  @ApiProperty({
    description: 'Company theme configuration',
  })
  @ValidateNested()
  @Type(() => CompanyThemeConfig)
  @IsNotEmpty()
  company: CompanyThemeConfig;

  @ApiProperty({
    description: 'Questions theme configuration',
  })
  @ValidateNested()
  @Type(() => QuestionsThemeConfig)
  @IsNotEmpty()
  questions: QuestionsThemeConfig;

  @ApiProperty({
    description: 'Mentions theme configuration',
  })
  @ValidateNested()
  @Type(() => MentionsThemeConfig)
  @IsNotEmpty()
  mentions: MentionsThemeConfig;

  @ApiProperty({
    description: 'Moderator theme configuration',
  })
  @ValidateNested()
  @Type(() => ModeratorThemeConfig)
  @IsNotEmpty()
  moderator: ModeratorThemeConfig;
}
