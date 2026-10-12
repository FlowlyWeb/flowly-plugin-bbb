import { useEffect, useRef } from 'react';
import { usePluginContext } from '../../core/plugin/PluginContext';
import { DOMStyleService } from '../../../services/DOMStyleService';
import { ThemeService } from '../../../services/ThemeService';
import { MessageService } from '../../shared/services/messageService';
import { Colors } from '../../shared/utils/colors';

export const useMentionHighlight = () => {
  const { pluginApi } = usePluginContext();
  const styleId = useRef('mention-styles');
  const theme = ThemeService.getMentionColors();

  const currentUser = pluginApi?.useCurrentUser?.();
  const chatMessages = pluginApi?.useLoadedChatMessages?.();

  useEffect(() => {
    const currentStyleId = styleId.current;
    // Early return if module is disabled or required data is missing
    if (!theme?.isEnabled || !currentUser?.data?.name || !chatMessages?.data) {
      DOMStyleService.removeStyleSheet(currentStyleId);
      return;
    }

    // Get messages where current user is mentioned
    const mentionedMessageIds = MessageService.filterMentionMessages(
      chatMessages.data,
      currentUser.data.name,
    );

    // Remove styles if no mentions found
    if (mentionedMessageIds.length === 0) {
      DOMStyleService.removeStyleSheet(styleId.current);
      return;
    }

    // Create selectors for mentioned messages
    const mentionSelectors = mentionedMessageIds
      .map((id) => `[data-chat-message-id="${id}"][role="listitem"]`)
      .join(',\n');

    const textColor = Colors.getContrastColor(theme.backgroundColor);

    const css = `
            /* Base styles for mentioned messages */
            ${mentionSelectors} {
                background-color: ${theme.backgroundColor} !important;
                border-left: 4px solid ${theme.mainColor} !important;
                color: ${textColor} !important;
                margin: 4px 0 !important;
                transition: all 0.3s ease !important;
            }

            /* Force text color on all descendants except toolbar icons */
            ${mentionedMessageIds.map((id) => `[data-chat-message-id="${id}"][role="listitem"] *:not(.chat-message-toolbar):not(.chat-message-toolbar *)`).join(',\n')} {
                color: ${textColor} !important;
            }

            /* Hover effect for mentioned messages */
            ${mentionedMessageIds.map((id) => `[data-chat-message-id="${id}"][role="listitem"]:hover`).join(',\n')} {
                background-color: ${theme.backgroundColor}E6 !important;
                transform: translateX(2px);
            }

            /* Style priority rules for mentioned messages */
            ${mentionSelectors}.moderator-message,
            ${mentionSelectors}.question-highlight {
                background-color: ${theme.backgroundColor} !important;
                border-left: 4px solid ${theme.mainColor} !important;
                color: ${textColor} !important;
            }
        `;

    DOMStyleService.createStyleSheet(currentStyleId, css);

    return () => {
      DOMStyleService.removeStyleSheet(currentStyleId);
    };
  }, [currentUser?.data?.name, chatMessages?.data, theme]);
};
