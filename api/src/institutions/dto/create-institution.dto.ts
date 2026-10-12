import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';
import { Style } from '../entities/style.entity';
import { ApiProperty } from '@nestjs/swagger';
import { GeoRegion } from '../../auth/dto/register.dto';

export class CreateInstitutionDto {
  @ApiProperty({ description: 'The name of the institution' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'The domain of the institution' })
  @IsString()
  @IsNotEmpty()
  domain: string;

  @ApiProperty({
    example: 'france',
    description: 'Geographic region of the institution',
    enum: GeoRegion,
    default: GeoRegion.FRANCE,
    required: false,
  })
  @IsOptional()
  @IsEnum(GeoRegion)
  geoRegion?: GeoRegion;

  @ApiProperty({
    description: 'The address of the institution',
    example: '123 Rue de Paris, 75001 Paris, France',
  })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({
    description: 'The VAT number of the institution (optional)',
    example: 'FR12345678901',
    required: false,
  })
  @IsString()
  @IsOptional()
  vatNumber?: string;

  @IsObject()
  @IsOptional()
  styles?: Partial<Style>;
}
