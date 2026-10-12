import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class HeartbeatDto {
  @ApiProperty({
    description: 'Unique identifier of the BBB server',
    example: 'server01.bbb.yourdomain.com',
  })
  @IsString()
  @IsNotEmpty()
  serverId: string;

  @ApiProperty({
    description: 'Unique identifier of the BBB meeting',
    example: 'meeting-2023-05-12-123456',
  })
  @IsString()
  @IsNotEmpty()
  meetingId: string;

  @ApiProperty({
    description: 'Identifier of the user (typically a moderator) sending the heartbeat',
    example: 'user123',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;
}
