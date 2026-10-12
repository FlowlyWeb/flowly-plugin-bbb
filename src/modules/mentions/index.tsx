import React from 'react';
import { createPortal } from 'react-dom';
import { usePluginContext } from '../core/plugin/PluginContext';
import { useMentionSuggestions } from './hooks/useMentionSuggestions';
import SuggestionBox from './components/SuggestionBox';
import { useMentionHighlight } from './hooks/useMentionHighlight';
import { ThemeService } from '../../services/ThemeService';

/**
 * Module responsible for handling mention-related features in the chat.
 * This includes:
 * - Highlighting messages that mention the current user
 * - Providing mention suggestions while typing
 * - Managing the mention suggestion UI
 */
export const MentionsModule: React.FC = () => {
  const isEnabled = ThemeService.isModuleEnabled('mentions');
  const { pluginApi } = usePluginContext();

  // Get mention suggestion functionality
  const { mentionState, suggestions, insertMention, closeSuggestions, handleHover } =
    useMentionSuggestions();

  // Apply mention highlighting
  useMentionHighlight();

  if (!isEnabled) {
    return null;
  }

  // Find the message form container for the suggestion box portal
  const messageForm = document.querySelector('.sc-ksJxCS');

  if (!pluginApi || !messageForm) {
    return null;
  }

  // Render suggestion box only when active and positioned
  return mentionState.isActive && mentionState.position
    ? createPortal(
        <SuggestionBox
          query={mentionState.query}
          suggestions={suggestions}
          selectedIndex={mentionState.selectedIndex}
          position={mentionState.position}
          onSelect={insertMention}
          onHover={handleHover}
          onClose={closeSuggestions}
        />,
        messageForm,
      )
    : null;
};

export default MentionsModule;
