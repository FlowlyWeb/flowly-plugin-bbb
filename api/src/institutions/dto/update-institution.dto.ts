import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, Min, IsString, IsBoolean } from 'class-validator';
import { PricingTier } from '../entities/institution.entity';

/**
 * DTO for updating institution properties
 * Used by flowly-core to synchronize pricing tier and quotas
 * Also used by flowly-admin to update institution info
 */
export class UpdateInstitutionDto {
  @ApiProperty({
    enum: PricingTier,
    required: false,
    description: 'Updated pricing tier for the institution',
    example: PricingTier.PRO,
  })
  @IsOptional()
  @IsEnum(PricingTier)
  currentPricingTier?: PricingTier;

  @ApiProperty({
    required: false,
    description: 'Maximum number of servers allowed for the current plan',
    example: 10,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quotaServerLimit?: number;

  @ApiProperty({
    required: false,
    description: 'Maximum number of sub-organizations allowed for the current plan',
    example: 3,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quotaSubOrgLimit?: number;

  @ApiProperty({
    required: false,
    description: 'Institution name',
    example: 'Université de Paris',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    required: false,
    description: 'Institution domain (without @)',
    example: 'univ-paris.fr',
  })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiProperty({
    required: false,
    description: 'Institution address',
    example: "1 Rue de l'Université, 75007 Paris, France",
  })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    required: false,
    description: 'VAT number',
    example: 'FR12345678901',
  })
  @IsOptional()
  @IsString()
  vatNumber?: string;

  @ApiProperty({
    required: false,
    description: 'Geographic region',
    example: 'france',
    enum: ['france', 'eu', 'world'],
  })
  @IsOptional()
  @IsEnum(['france', 'eu', 'world'])
  geoRegion?: string;

  @ApiProperty({
    required: false,
    description: 'Whether the institution is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
