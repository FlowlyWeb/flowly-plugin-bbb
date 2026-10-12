import { useEffect, useRef } from 'react';
import { DOMStyleService } from '../../../services/DOMStyleService';
import { ThemeService } from '../../../services/ThemeService';
import { Colors } from '../../shared/utils/colors';

/**
 * Hook that manages the styling of moderator messages in the chat.
 * Handles both the initial styling and cleanup when component unmounts.
 */
export const useModeratorStyles = (moderatorMessageIds: string[], chatElements: HTMLElement[]) => {
  const styleId = useRef('moderator-styles');
  const theme = ThemeService.getModeratorColors();

  useEffect(() => {
    const currentStyleId = styleId.current;
    // Remove styles if module is disabled or no messages to style
    if (!theme?.isEnabled || moderatorMessageIds.length === 0) {
      DOMStyleService.removeStyleSheet(currentStyleId);
      return;
    }

    // Build CSS for moderator messages
    const textColor = Colors.getContrastColor(theme.backgroundColor);

    const css = `
            /* Base styles for moderator messages */
            ${moderatorMessageIds.map((id) => `[data-chat-message-id="${id}"][role="listitem"]`).join(',\n')} {
                background-color: ${theme.backgroundColor} !important;
                border-left: 4px solid ${theme.mainColor} !important;
                color: ${textColor} !important;
                margin: 4px 0 !important;
                transition: all 0.3s ease !important;
                position: relative;
            }

            /* Force text color on all descendants except toolbar icons */
            ${moderatorMessageIds.map((id) => `[data-chat-message-id="${id}"][role="listitem"] *:not(.chat-message-toolbar):not(.chat-message-toolbar *)`).join(',\n')} {
                color: ${textColor} !important;
            }

            /* Hover effect for moderator messages */
            ${moderatorMessageIds.map((id) => `[data-chat-message-id="${id}"][role="listitem"]:hover`).join(',\n')} {
                background-color: ${theme.backgroundColor}E6 !important;
                transform: translateX(2px);
            }
        `;

    DOMStyleService.createStyleSheet(currentStyleId, css);

    // Mark messages as moderator messages for future reference
    chatElements.forEach((element) => {
      if (element) {
        element.dataset.moderatorMessage = 'true';
        element.dataset.messageType = 'moderator';
      }
    });

    return () => {
      DOMStyleService.removeStyleSheet(currentStyleId);
    };
  }, [moderatorMessageIds, chatElements, theme]);
};
