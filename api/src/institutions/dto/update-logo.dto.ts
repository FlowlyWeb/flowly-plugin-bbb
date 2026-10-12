import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateLogoDto {
  @ApiProperty({
    description: 'Company logo in base64 format',
    example: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAA...',
  })
  @IsString()
  @IsNotEmpty()
  logo: string;
}
