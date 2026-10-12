import { useState, useEffect, useCallback } from 'react';
import { PluginApi, LoadedChatMessage } from 'bigbluebutton-html-plugin-sdk';
import { MessageService } from '../../shared/services/messageService';

export const useQuestionDetection = (pluginApi: PluginApi | null) => {
  const [questionMessageIds, setQuestionMessageIds] = useState<string[]>([]);
  const chatMessages = pluginApi?.useLoadedChatMessages?.() || { data: [] as LoadedChatMessage[] };

  const updateQuestions = useCallback((messages: LoadedChatMessage[]) => {
    const newIds = MessageService.filterQuestionMessages(messages);

    setQuestionMessageIds((prevIds) => {
      if (JSON.stringify(prevIds) !== JSON.stringify(newIds)) {
        return newIds;
      }
      return prevIds;
    });
  }, []);

  useEffect(() => {
    if (!pluginApi) {
      // eslint-disable-next-line no-console
      console.warn('API BBB non disponible');
      return;
    }

    if (chatMessages.data) {
      updateQuestions(chatMessages.data);
    }

    const intervalId = setInterval(() => {
      if (chatMessages.data) {
        updateQuestions(chatMessages.data);
      }
    }, 2000);

    return () => clearInterval(intervalId);
  }, [pluginApi, chatMessages.data, updateQuestions]);

  return {
    questionMessageIds,
    chatMessages,
    refreshQuestions: () => chatMessages.data && updateQuestions(chatMessages.data),
  };
};
