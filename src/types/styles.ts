/**
 * Gradient background configuration
 */
export interface GradientBackground {
  color1: string;
  color2: string;
  direction:
    | 'to-top'
    | 'to-right'
    | 'to-bottom'
    | 'to-left'
    | 'to-top-right'
    | 'to-top-left'
    | 'to-bottom-right'
    | 'to-bottom-left';
}

/**
 * Image background configuration
 */
export interface ImageBackground {
  data: string;
  size: 'cover' | 'contain' | 'repeat';
  position:
    | 'center'
    | 'top'
    | 'bottom'
    | 'left'
    | 'right'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right';
}

/**
 * Background configuration (union type)
 */
export interface Background {
  type: 'solid' | 'gradient' | 'image';
  color?: string;
  gradient?: GradientBackground;
  image?: ImageBackground;
}

/**
 * Company branding configuration
 */
export interface CompanyColors {
  primaryColor: string;
  background: Background;
  logo: string | null;
  favicon?: string;
}

export interface BadgeStyle {
  iconName: string;
  color: string;
}

/**
 * Base style options for module theme application
 */
export interface StyleOptions {
  backgroundColor: string;
  borderLeft: string;
  margin: string;
  badge?: BadgeStyle | null;
}

/**
 * Alias for ThemeColors used in mention-specific contexts
 */
export type MentionThemeColors = ThemeColors;

/**
 * Base theme colors with optional badge
 */
export interface ThemeColors {
  mainColor: string;
  backgroundColor: string;
  badge?: BadgeStyle | null;
  isEnabled: boolean;
}

/**
 * Question theme configuration
 */
export interface QuestionThemeColors extends ThemeColors {
  badge: BadgeStyle | null;
  keyword: string | null;
}

/**
 * Moderator theme configuration
 */
export interface ModeratorThemeColors extends ThemeColors {
  badge: BadgeStyle | null;
}

/**
 * GIF module configuration
 */
export interface GifModuleConfig {
  isEnabled: boolean;
}

/**
 * Usernames module configuration
 */
export interface UsernamesModuleConfig {
  isEnabled: boolean;
}

/**
 * Complete styles configuration
 */
export interface Styles {
  id: string;
  name: string;
  company: CompanyColors;
  questions: QuestionThemeColors;
  mentions: ThemeColors;
  moderator: ModeratorThemeColors;
  gif: GifModuleConfig;
  usernames: UsernamesModuleConfig;
}
