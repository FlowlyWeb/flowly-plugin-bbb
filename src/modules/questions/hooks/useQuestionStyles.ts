import { useEffect, useRef } from 'react';
import { DOMStyleService } from '../../../services/DOMStyleService';
import { ThemeService } from '../../../services/ThemeService';
import { Colors } from '../../shared/utils/colors';

export const useQuestionStyles = (questionMessageIds: string[]) => {
  const styleId = useRef('question-styles');
  const theme = ThemeService.getQuestionColors();

  useEffect(() => {
    const currentStyleId = styleId.current;
    // Early return if module is disabled or no theme available
    if (!theme?.isEnabled || questionMessageIds.length === 0) {
      DOMStyleService.removeStyleSheet(currentStyleId);
      return;
    }

    // Create selectors for all question messages
    const questionSelectors = questionMessageIds
      .map((id) => `[data-chat-message-id="${id}"][role="listitem"]`)
      .join(',\n');

    const textColor = Colors.getContrastColor(theme.backgroundColor);

    const css = `
            /* Base styles for question messages */
            ${questionSelectors} {
                background-color: ${theme.backgroundColor} !important;
                border-left: 4px solid ${theme.mainColor} !important;
                color: ${textColor} !important;
                margin: 4px 0 !important;
                transition: all 0.3s ease !important;
            }

            /* Force text color on all descendants except toolbar icons */
            ${questionMessageIds.map((id) => `[data-chat-message-id="${id}"][role="listitem"] *:not(.chat-message-toolbar):not(.chat-message-toolbar *)`).join(',\n')} {
                color: ${textColor} !important;
            }

            /* Hover effect with semi-transparent background */
            ${questionMessageIds.map((id) => `[data-chat-message-id="${id}"][role="listitem"]:hover`).join(',\n')} {
                background-color: ${theme.backgroundColor}E6 !important;
                transform: translateX(2px);
            }

            /* Ensure styles persist across different states */
            ${questionSelectors}.fiPnVG,
            ${questionSelectors}.eGQkOZ,
            ${questionSelectors}[class*="sc-"] {
                background-color: ${theme.backgroundColor} !important;
                border-left: 4px solid ${theme.mainColor} !important;
                color: ${textColor} !important;
            }
        `;

    DOMStyleService.createStyleSheet(currentStyleId, css);

    return () => {
      DOMStyleService.removeStyleSheet(currentStyleId);
    };
  }, [questionMessageIds, theme]);
};
