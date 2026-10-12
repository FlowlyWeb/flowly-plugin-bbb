import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for approving an update
 */
export class ApproveUpdateDto {
  @ApiPropertyOptional({
    description: 'Optional note about the update approval',
    example: 'Approved after testing in staging environment',
  })
  @IsString()
  @IsOptional()
  note?: string;
}
