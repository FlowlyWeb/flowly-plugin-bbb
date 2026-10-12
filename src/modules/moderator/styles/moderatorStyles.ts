import { StyleOptions, ModeratorThemeColors } from '../../../types/styles';
import { ThemeService } from '../../../services/ThemeService';

/**
 * Creates style options for moderator messages based on the current theme.
 * Includes a safety fallback for when the moderator module is disabled.
 */
export const getModeratorStyleOptions = (): StyleOptions => {
  const moderatorTheme = ThemeService.getModeratorColors();

  if (!moderatorTheme) {
    // Provide neutral styles when module is disabled
    return {
      backgroundColor: 'transparent',
      borderLeft: 'none',
      margin: '0',
    };
  }

  return {
    backgroundColor: moderatorTheme.backgroundColor,
    borderLeft: `4px solid ${moderatorTheme.mainColor}`,
    margin: '4px 0',
    badge: moderatorTheme.badge,
  };
};

/**
 * Retrieves the complete moderator theme configuration if enabled.
 */
export const getModeratorTheme = (): ModeratorThemeColors | null => {
  return ThemeService.getModeratorColors();
};
