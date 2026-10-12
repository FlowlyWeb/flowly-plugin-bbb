import * as React from 'react';
import { useQuestionStyles } from './hooks/useQuestionStyles';
import { useQuestionDetection } from './hooks/useQuestionDetection';
import { useQuestionBadge } from './hooks/useQuestionBadges';
import { usePluginContext } from '../core/plugin/PluginContext';
import { ThemeService } from '../../services/ThemeService';

/**
 * Module responsible for handling question-related functionality in the chat.
 * This includes:
 * - Detecting questions based on keywords
 * - Applying special styling to question messages
 * - Adding visual indicators (badges) to users who ask questions
 */
export const QuestionsModule: React.FC = () => {
  const isEnabled = ThemeService.isModuleEnabled('questions');
  const { pluginApi } = usePluginContext();
  const { questionMessageIds } = useQuestionDetection(pluginApi);

  // Apply question styles and badges only if the module is enabled
  useQuestionStyles(questionMessageIds);
  useQuestionBadge(pluginApi, questionMessageIds);

  if (!isEnabled) {
    return null;
  }

  return null;
};
