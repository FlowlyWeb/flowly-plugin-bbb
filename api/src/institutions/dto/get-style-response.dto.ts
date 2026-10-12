import { ApiProperty } from '@nestjs/swagger';

export class BadgeResponseDto {
  @ApiProperty({
    description: 'Font Awesome icon name',
    example: 'question',
  })
  iconName: string;

  @ApiProperty({
    description: 'Badge color in hexadecimal format',
    example: '#FF9800',
  })
  color: string;
}

export class StylesResponseDto {
  @ApiProperty({
    description: 'Institution identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Institution name',
    example: 'My University',
  })
  name: string;

  @ApiProperty({
    description: 'Company branding configuration',
  })
  company: {
    primaryColor: string;
    background: {
      type: 'solid' | 'gradient' | 'image';
      color?: string;
      gradient?: {
        color1: string;
        color2: string;
        direction: string;
      };
      image?: {
        data: string;
        size: string;
        position: string;
      };
    };
    logo: string | null;
  };

  @ApiProperty({
    description: 'Questions module configuration',
  })
  questions: {
    mainColor: string;
    backgroundColor: string;
    badge: BadgeResponseDto | null;
    keyword: string | null;
    isEnabled: boolean;
  };

  @ApiProperty({
    description: 'Mentions module configuration',
  })
  mentions: {
    mainColor: string;
    backgroundColor: string;
    isEnabled: boolean;
  };

  @ApiProperty({
    description: 'Moderator module configuration',
  })
  moderator: {
    mainColor: string;
    backgroundColor: string;
    badge: BadgeResponseDto | null;
    isEnabled: boolean;
  };

  @ApiProperty({
    description: 'GIF module configuration',
  })
  gif: {
    isEnabled: boolean;
  };

  @ApiProperty({
    description: 'Usernames module configuration',
  })
  usernames: {
    isEnabled: boolean;
  };

  @ApiProperty({
    description: 'ID of the theme template currently applied, or null if manually modified',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
    required: false,
  })
  appliedThemeTemplateId?: string | null;
}
