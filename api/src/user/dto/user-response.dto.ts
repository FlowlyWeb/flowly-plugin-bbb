import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for user response data
 */
export class UserResponseDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'User ID',
  })
  id: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'User email',
  })
  email: string;

  @ApiProperty({
    example: 'John',
    description: 'User first name',
  })
  firstName: string;

  @ApiProperty({
    example: 'Doe',
    description: 'User last name',
  })
  lastName: string;

  @ApiProperty({
    example: true,
    description: 'Whether the user is active',
  })
  isActive: boolean;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'Last time the user was seen',
    nullable: true,
  })
  lastSeen: Date | null;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'User creation date',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2023-01-01T00:00:00.000Z',
    description: 'User last update date',
  })
  updatedAt: Date;

  constructor(user: Partial<UserResponseDto>) {
    this.id = user.id!;
    this.email = user.email!;
    this.firstName = user.firstName!;
    this.lastName = user.lastName!;
    this.isActive = user.isActive!;
    this.lastSeen = user.lastSeen ?? null;
    this.createdAt = user.createdAt!;
    this.updatedAt = user.updatedAt!;
  }
}
