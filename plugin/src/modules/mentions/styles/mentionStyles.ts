import { StyleOptions, MentionThemeColors } from '../../../types/styles';
import { ThemeService } from '../../../services/ThemeService';

/**
 * Creates style options for mentioned messages based on the current theme.
 * Returns neutral styles if the mentions module is disabled to ensure graceful fallback.
 */
export const getMentionStyleOptions = (): StyleOptions => {
  const mentionTheme = ThemeService.getMentionColors();

  if (!mentionTheme) {
    return {
      backgroundColor: 'transparent',
      borderLeft: 'none',
      margin: '0',
    };
  }

  return {
    backgroundColor: mentionTheme.backgroundColor,
    borderLeft: `4px solid ${mentionTheme.mainColor}`,
    margin: '4px 0',
  };
};

/**
 * Retrieves the complete mention theme configuration if the module is enabled.
 * Used when components need access to all mention-specific properties.
 */
export const getMentionTheme = (): MentionThemeColors | null => {
  return ThemeService.getMentionColors();
};
