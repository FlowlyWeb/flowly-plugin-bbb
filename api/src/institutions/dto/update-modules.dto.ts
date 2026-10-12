import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateModulesDto {
  @ApiProperty({
    description: 'Enable/disable questions module',
  })
  @IsBoolean()
  @IsNotEmpty()
  questionsEnabled: boolean;

  @ApiProperty({
    description: 'Enable/disable mentions module',
  })
  @IsBoolean()
  @IsNotEmpty()
  mentionsEnabled: boolean;

  @ApiProperty({
    description: 'Enable/disable moderator module',
  })
  @IsBoolean()
  @IsNotEmpty()
  moderatorEnabled: boolean;

  @ApiProperty({
    description: 'Enable/disable GIF module',
  })
  @IsBoolean()
  @IsNotEmpty()
  gifEnabled: boolean;

  @ApiProperty({
    description: 'Enable/disable Usernames module',
  })
  @IsBoolean()
  @IsNotEmpty()
  usernamesEnabled: boolean;
}
