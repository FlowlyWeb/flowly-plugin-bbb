import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, IsOptional, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Gradient background configuration
 * Defines a linear gradient with two colors and a direction
 */
export class GradientConfig {
  @ApiProperty({
    description: 'First gradient color (hex format)',
    example: '#0F70D7',
  })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color1 must be a valid hex color (e.g., #0F70D7)',
  })
  color1: string;

  @ApiProperty({
    description: 'Second gradient color (hex format)',
    example: '#06172A',
  })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color2 must be a valid hex color (e.g., #06172A)',
  })
  color2: string;

  @ApiProperty({
    description: 'Gradient direction',
    enum: [
      'to-top',
      'to-right',
      'to-bottom',
      'to-left',
      'to-top-right',
      'to-top-left',
      'to-bottom-right',
      'to-bottom-left',
    ],
    example: 'to-bottom',
  })
  @IsIn([
    'to-top',
    'to-right',
    'to-bottom',
    'to-left',
    'to-top-right',
    'to-top-left',
    'to-bottom-right',
    'to-bottom-left',
  ])
  direction:
    | 'to-top'
    | 'to-right'
    | 'to-bottom'
    | 'to-left'
    | 'to-top-right'
    | 'to-top-left'
    | 'to-bottom-right'
    | 'to-bottom-left';
}

/**
 * Image background configuration
 * Defines an image with display options
 */
export class ImageConfig {
  @ApiProperty({
    description: 'Base64 encoded image data (data URI format: data:image/png;base64,...)',
    example:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  })
  @IsString()
  @Matches(/^data:image\/(png|jpeg|jpg);base64,[A-Za-z0-9+/=]+$/, {
    message: 'data must be a valid base64 data URI for PNG or JPEG image',
  })
  data: string;

  @ApiProperty({
    description: 'Background image size behavior',
    enum: ['cover', 'contain', 'repeat'],
    example: 'cover',
  })
  @IsIn(['cover', 'contain', 'repeat'])
  size: 'cover' | 'contain' | 'repeat';

  @ApiProperty({
    description: 'Background image position',
    enum: [
      'center',
      'top',
      'bottom',
      'left',
      'right',
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ],
    example: 'center',
  })
  @IsIn([
    'center',
    'top',
    'bottom',
    'left',
    'right',
    'top-left',
    'top-right',
    'bottom-left',
    'bottom-right',
  ])
  position:
    | 'center'
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right';
}

/**
 * Background configuration (union type)
 * Supports solid color, gradient, or image
 */
export class BackgroundConfig {
  @ApiProperty({
    description: 'Background type',
    enum: ['solid', 'gradient', 'image'],
    example: 'solid',
  })
  @IsIn(['solid', 'gradient', 'image'])
  type: 'solid' | 'gradient' | 'image';

  @ApiProperty({
    description: 'Solid color (hex format) - required when type is "solid"',
    example: '#06172A',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'color must be a valid hex color (e.g., #06172A)',
  })
  color?: string;

  @ApiProperty({
    description: 'Gradient configuration - required when type is "gradient"',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GradientConfig)
  gradient?: GradientConfig;

  @ApiProperty({
    description: 'Image configuration - required when type is "image"',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ImageConfig)
  image?: ImageConfig;
}

/**
 * DTO for updating company colors
 * Available for Starter tier and above
 */
export class UpdateColorsDto {
  @ApiProperty({
    description: 'Primary company color (hex format)',
    example: '#0F70D7',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'primaryColor must be a valid hex color (e.g., #0F70D7)',
  })
  primaryColor?: string;

  @ApiProperty({
    description: 'Background configuration (solid color, gradient, or image)',
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BackgroundConfig)
  background?: BackgroundConfig;
}
