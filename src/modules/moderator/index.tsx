import * as React from 'react';
import { useModeratorMessages } from './hooks/useModeratorMessages';
import { useModeratorStyles } from './hooks/useModeratorStyles';
import { usePluginContext } from '../core/plugin/PluginContext';
import { useModeratorBadge } from './hooks/useModeratorBadge';
import { ThemeService } from '../../services/ThemeService';

/**
 * Module responsible for handling moderator-specific features in the chat.
 * This includes:
 * - Styling moderator messages
 * - Adding moderator badges to usernames
 * - Tracking moderator message states
 */
export const ModeratorModule: React.FC = () => {
  const isEnabled = ThemeService.isModuleEnabled('moderator');
  const { pluginApi } = usePluginContext();
  const { moderatorMessageIds } = useModeratorMessages(pluginApi);
  const chatElements = pluginApi?.useChatMessageDomElements?.(moderatorMessageIds) || [];

  // Apply moderator styles and badges only if module is enabled
  useModeratorStyles(moderatorMessageIds, chatElements);
  useModeratorBadge(pluginApi);

  if (!isEnabled) {
    return null;
  }

  return null;
};
