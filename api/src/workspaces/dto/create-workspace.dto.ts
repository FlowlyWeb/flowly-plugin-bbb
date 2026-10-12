import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for creating a new workspace
 */
export class CreateWorkspaceDto {
  @ApiProperty({
    description: 'Display name of the workspace',
    example: 'Académie de Bretagne',
    minLength: 2,
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({
    description:
      'Unique code for the workspace (passed to BBB via the plugin_FlowlyPlugin_workspace parameter). Must be uppercase alphanumeric with underscores.',
    example: 'ACAD_BRETAGNE',
    minLength: 2,
    maxLength: 50,
  })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'Code must contain only uppercase letters, numbers, and underscores',
  })
  code: string;

  @ApiProperty({
    description: 'Optional description of the workspace',
    example: 'Workspace for the Brittany regional academy',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
