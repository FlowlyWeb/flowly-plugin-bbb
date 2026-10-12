import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateWorkspaceDto } from './create-workspace.dto';

/**
 * DTO for updating an existing workspace
 * All fields are optional
 */
export class UpdateWorkspaceDto extends PartialType(CreateWorkspaceDto) {
  @ApiProperty({
    description: 'Whether the workspace is active',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
