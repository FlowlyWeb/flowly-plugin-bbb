import { LoadedChatMessage } from 'bigbluebutton-html-plugin-sdk';
import { UsersBasicInfoData } from 'bigbluebutton-html-plugin-sdk/dist/cjs/data-consumption/domain/users/users-basic-info/types';
import { ThemeService } from '../../../services/ThemeService';

/**
 * Service responsible for processing and filtering chat messages.
 * Handles question detection, mentions, and message type checking.
 */
export class MessageService {
  /**
   * Default multilingual question keywords.
   * Used as fallback when custom keyword is not available.
   */
  private static readonly defaultQuestionKeywords = [
    '@question', // English
    '@pregunta', // Spanish
    '@frage', // German
    '@سؤال', // Arabic
    '@pergunta', // Portuguese (both Brazilian and European)
    '@questão', // Alternative Portuguese
  ];

  /**
   * Gets all valid question keywords, including custom keyword if available.
   * Custom keyword takes precedence over default keywords if defined.
   */
  static getQuestionKeywords(): string[] {
    const questionTheme = ThemeService.getQuestionColors();

    // If questions module is disabled, return empty array
    if (!questionTheme?.isEnabled) {
      return [];
    }

    // If custom keyword is defined, use it exclusively
    if (questionTheme.keyword) {
      return [questionTheme.keyword];
    }

    // Otherwise, fall back to default multilingual keywords
    return this.defaultQuestionKeywords;
  }

  /**
   * Filters messages to identify questions based on keywords.
   * Supports both custom and default multilingual keywords.
   *
   * @param messages - Array of chat messages to filter
   * @returns Array of message IDs that contain questions
   */
  static filterQuestionMessages(messages: LoadedChatMessage[]): string[] {
    const keywords = this.getQuestionKeywords();

    // If no keywords available (module disabled), return empty array
    if (keywords.length === 0) {
      return [];
    }

    return messages
      .filter((msg) => {
        if (!msg.message) return false;

        const lowercaseMessage = msg.message.toLowerCase();
        return keywords.some((keyword) => lowercaseMessage.includes(keyword.toLowerCase()));
      })
      .map((msg) => msg.messageId);
  }

  /**
   * Filters messages to find mentions of a specific user.
   *
   * @param messages - Array of chat messages to filter
   * @param username - Username to look for mentions of
   * @returns Array of message IDs that mention the user
   */
  static filterMentionMessages(messages: LoadedChatMessage[], username: string): string[] {
    if (!username) return [];

    return messages
      .filter((msg) => {
        if (!msg.message) return false;

        return msg.message.toLowerCase().includes(`@${username.toLowerCase()}`);
      })
      .map((msg) => msg.messageId);
  }

  /**
   * Analyzes a message to determine its type and properties.
   * Checks for questions and mentions in the message content.
   *
   * @param message - Message content to analyze
   * @param usersList - Optional list of users to check for mentions
   * @returns Object containing analysis results
   */
  static checkMessageType(
    message: string,
    usersList?: UsersBasicInfoData[],
  ): {
    isQuestion: boolean;
    hasMention: boolean;
    mentionedUsers: UsersBasicInfoData[];
  } {
    if (!message) {
      return { isQuestion: false, hasMention: false, mentionedUsers: [] };
    }

    const lowercaseMessage = message.toLowerCase();
    const keywords = this.getQuestionKeywords();

    // Check if message contains any question keywords
    const isQuestion = keywords.some((keyword) => lowercaseMessage.includes(keyword.toLowerCase()));

    let mentionedUsers: UsersBasicInfoData[] = [];

    // Check for user mentions if usersList is provided
    if (usersList) {
      mentionedUsers = usersList.filter((user) => {
        // Escape special characters in username
        const escapedName = user.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Create pattern to match exact username with @ prefix
        const userPattern = new RegExp(`@${escapedName}\\b`, 'gu');
        return userPattern.test(message);
      });
    }

    return {
      isQuestion,
      hasMention: mentionedUsers.length > 0,
      mentionedUsers,
    };
  }
}
