import { StyleOptions, QuestionThemeColors } from '../../../types/styles';
import { ThemeService } from '../../../services/ThemeService';

/**
 * Converts the question theme configuration into component-ready style options.
 * This includes converting the mainColor into a border style and ensuring
 * all required style properties are present.
 */
export const getQuestionStyleOptions = (): StyleOptions => {
  const questionTheme = ThemeService.getQuestionColors();

  if (!questionTheme) {
    // eslint-disable-next-line no-console
    console.warn('Question module is disabled or theme is not available');
    return {
      backgroundColor: 'transparent',
      borderLeft: 'none',
      margin: '0',
    };
  }

  return {
    backgroundColor: questionTheme.backgroundColor,
    borderLeft: `4px solid ${questionTheme.mainColor}`,
    margin: '4px 0',
    badge: questionTheme.badge,
  };
};

/**
 * Gets the complete question theme configuration if the module is enabled.
 * Returns null if the module is disabled.
 */
export const getQuestionTheme = (): QuestionThemeColors | null => {
  return ThemeService.getQuestionColors();
};
