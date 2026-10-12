import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateFaviconDto {
  @ApiProperty({
    description: 'Company favicon in base64 format (PNG, ICO, or SVG)',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^data:image\/(png|x-icon|svg\+xml);base64,/, {
    message: 'Favicon must be a valid base64 PNG, ICO, or SVG image',
  })
  @MaxLength(140000, {
    message: 'Favicon size must not exceed 100KB',
  })
  favicon: string;
}
