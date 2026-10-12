import { useState, useEffect, useMemo } from 'react';
import { PluginApi, LoadedChatMessage } from 'bigbluebutton-html-plugin-sdk';
import { MessageService } from '../../shared/services/messageService';

export const useModeratorMessages = (pluginApi: PluginApi | null) => {
  const [moderatorMessageIds, setModeratorMessageIds] = useState<string[]>([]);
  const chatMessages = pluginApi?.useLoadedChatMessages?.();
  const users = pluginApi?.useUsersBasicInfo?.();
  const rawChatElements = pluginApi?.useChatMessageDomElements?.(moderatorMessageIds);
  const chatElements = useMemo(() => rawChatElements || [], [rawChatElements]);
  const currentUser = pluginApi?.useCurrentUser?.(); // Get the current user
  const allUsers = pluginApi?.useUsersBasicInfo?.(); // Get all users connected to the meeting

  useEffect(() => {
    if (!pluginApi || !chatMessages?.data || !users?.data) {
      return;
    }

    const newModeratorMessageIds = chatMessages.data
      .filter((msg: LoadedChatMessage) => {
        const isActiveModerator =
          users?.data?.user.some(
            (user) => user.userId === msg.senderUserId && user.role === 'MODERATOR',
          ) ?? false;

        const element = document.querySelector(
          `[data-chat-message-id="${msg.messageId}"]`,
        ) as HTMLElement;
        const hadModeratorFlag = element?.dataset.moderatorMessage === 'true';

        const messageTypeInfo = MessageService.checkMessageType(msg.message, allUsers?.data?.user); // Check the type of the message (question or mention)

        // Check if the current user is mentioned in the message
        const isCurrentUserMentioned = messageTypeInfo.mentionedUsers.some(
          (user) => user.name === currentUser?.data?.name,
        );

        // Return messages that are not questions, are not mentions of the current user, and are from a moderator
        // If the message already had the moderator flag, keep it
        // This is to avoid removing the moderator flag when the message is updated
        // and to make sure questions and mentions is highlighted correctly
        return (
          (isActiveModerator || hadModeratorFlag) &&
          !messageTypeInfo.isQuestion &&
          !isCurrentUserMentioned
        );
      })
      .map((msg: LoadedChatMessage) => msg.messageId);

    setModeratorMessageIds(newModeratorMessageIds);
  }, [pluginApi, chatMessages?.data, users?.data, allUsers?.data?.user, currentUser?.data?.name]);

  useEffect(() => {
    chatElements.forEach((element: HTMLDivElement) => {
      if (element) {
        element.dataset.moderatorMessage = 'true';
        element.dataset.messageType = 'moderator';
      }
    });
  }, [chatElements]);

  return { moderatorMessageIds, chatMessages, users };
};
