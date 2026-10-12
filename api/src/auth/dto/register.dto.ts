import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, Matches, IsOptional, IsEnum } from 'class-validator';

export enum GeoRegion {
  FRANCE = 'france',
  EU = 'eu',
  WORLD = 'world',
}

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address of the user',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'yourPassword123',
    description: 'User password (minimum 8 characters)',
  })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    example: 'John',
    description: 'First name of the user',
  })
  @IsString()
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Last name of the user',
  })
  @IsString()
  lastName: string;

  @ApiProperty({
    example: 'My Company',
    description: 'Name of the institution',
  })
  @IsString()
  institutionName: string;

  @ApiProperty({
    example: 'mycompany.com',
    description: 'Domain of the institution',
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/, {
    message: 'Invalid domain format',
  })
  institutionDomain: string;

  @ApiProperty({
    example: '123 Rue de Paris, 75001 Paris, France',
    description: 'Address of the institution',
  })
  @IsString()
  address: string;

  @ApiProperty({
    example: 'FR12345678901',
    description: 'VAT number of the institution (optional)',
    required: false,
  })
  @IsString()
  @IsOptional()
  vatNumber?: string;

  @ApiProperty({
    example: 'france',
    description: 'Geographic region of the institution',
    enum: GeoRegion,
    default: GeoRegion.FRANCE,
  })
  @IsEnum(GeoRegion)
  geoRegion: GeoRegion;
}
