import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsObject } from 'class-validator';

/**
 * DTO for updating workspace style
 * All fields are optional - only provided fields will be updated
 */
export class UpdateWorkspaceStyleDto {
  @ApiProperty({
    description: 'Company section with colors, logo, and favicon',
    example: {
      primaryColor: '#0F70D7',
      secondaryColor: '#06172A',
      logo: 'data:image/png;base64,...',
      favicon: 'data:image/png;base64,...',
    },
    required: false,
  })
  @IsOptional()
  @IsObject()
  company?: {
    primaryColor?: string;
    secondaryColor?: string;
    logo?: string | null;
    favicon?: string | null;
  };

  @ApiProperty({
    description: 'Questions module customization',
    required: false,
  })
  @IsOptional()
  @IsObject()
  questions?: {
    mainColor?: string;
    backgroundColor?: string;
    badge?: string | null;
    keyword?: string;
    isEnabled?: boolean;
  };

  @ApiProperty({
    description: 'Mentions module customization',
    required: false,
  })
  @IsOptional()
  @IsObject()
  mentions?: {
    mainColor?: string;
    backgroundColor?: string;
    isEnabled?: boolean;
  };

  @ApiProperty({
    description: 'Moderator module customization',
    required: false,
  })
  @IsOptional()
  @IsObject()
  moderator?: {
    mainColor?: string;
    backgroundColor?: string;
    badge?: string | null;
    isEnabled?: boolean;
  };

  @ApiProperty({
    description: 'GIF module customization',
    required: false,
  })
  @IsOptional()
  @IsObject()
  gif?: {
    isEnabled?: boolean;
  };

  @ApiProperty({
    description: 'Usernames module customization',
    required: false,
  })
  @IsOptional()
  @IsObject()
  usernames?: {
    isEnabled?: boolean;
  };
}
