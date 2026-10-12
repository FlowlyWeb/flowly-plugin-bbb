import { BadgeStyle, Background } from './styles';

/**
 * API response structure for styles
 * Matches the StylesResponseDto from flowly-api
 */
export interface StylesResponse {
  id: string;
  name: string;
  company: {
    primaryColor: string;
    background: Background;
    logo: string | null;
    favicon?: string;
  };
  questions: {
    mainColor: string;
    backgroundColor: string;
    badge: BadgeStyle | null;
    keyword: string | null;
    isEnabled: boolean;
  };
  mentions: {
    mainColor: string;
    backgroundColor: string;
    isEnabled: boolean;
  };
  moderator: {
    mainColor: string;
    backgroundColor: string;
    badge: BadgeStyle | null;
    isEnabled: boolean;
  };
  gif: {
    isEnabled: boolean;
  };
  usernames: {
    isEnabled: boolean;
  };
}

/**
 * API response for domain verification
 */
export interface ApiResponse {
  isValid: boolean;
  apiKey: string;
  institution: {
    name: string;
    domain: string;
    checksum: string;
  };
}
