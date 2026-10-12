import { usePluginContext } from '../../core/plugin/PluginContext';
import { useCallback, useEffect, useState } from 'react';
import { MentionState } from '../../../types';
import { MessageService } from '../../shared/services/messageService';

export const useMentionSuggestions = () => {
  const { pluginApi } = usePluginContext();
  const usersData = pluginApi?.useUsersBasicInfo?.(); // Fetch all connected users data

  const [mentionState, setMentionState] = useState<MentionState>({
    isActive: false,
    query: '',
    selectedIndex: 0,
    position: null,
  });

  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Update suggestions based on the query (after the '@' symbol)
  useEffect(() => {
    if (!usersData?.data?.user) return;

    let filteredSuggestions = usersData.data.user
      .filter((user) => user.name.toLowerCase().includes(mentionState.query.toLowerCase()))
      .map((user) => user.name);

    const questionKeywords = MessageService.getQuestionKeywords().map((keyword) =>
      keyword.replace(/@/g, ''),
    );

    filteredSuggestions = [...questionKeywords, ...filteredSuggestions];

    setSuggestions(filteredSuggestions);
  }, [mentionState.query, usersData?.data?.user]);

  // Handle the input event to detect the '@' symbol and display suggestions
  const handleInput = useCallback((event: Event) => {
    const target = event.target as HTMLTextAreaElement;
    if (!target || target.id !== 'message-input') return;

    const text = target.value; // Get the text from the textarea
    const cursorPosition = target.selectionStart ?? 0; // Get the cursor position
    const textUpToCursor = text.slice(0, cursorPosition); // Get the text before the cursor
    const lastAtIndex = textUpToCursor.lastIndexOf('@'); // Find the last '@' symbol

    // If there is no '@' symbol or if there is a space after the last '@', we close the suggestions
    if (lastAtIndex === -1 || textUpToCursor.slice(lastAtIndex + 1).includes(' ')) {
      setMentionState((prev) => ({ ...prev, isActive: false }));
      return;
    }

    const formContainer = target.closest('.sc-ksJxCS');

    if (formContainer) {
      const textareaRect = target.getBoundingClientRect(); // Get the textarea's position and dimensions
      const formRect = formContainer.getBoundingClientRect(); // Get the form's position and dimensions
      const query = textUpToCursor.slice(lastAtIndex + 1); // Get the query after the last '@'

      setMentionState((prev) => ({
        ...prev,
        isActive: true,
        query,
        selectedIndex: 0,
        position: {
          top: textareaRect.top - formRect.top,
          left: textareaRect.left - formRect.left,
          width: textareaRect.width,
        },
      }));
    }
  }, []);

  // Insert the selected mention in the textarea
  const insertMention = useCallback(
    async (username: string) => {
      const input = document.getElementById('message-input') as HTMLTextAreaElement;
      if (!input || !pluginApi) return;

      const text = input.value; // Get the text from the textarea
      const cursorPosition = input.selectionStart ?? 0; // Get the cursor position
      const textUpToCursor = text.slice(0, cursorPosition); // Get the text before the cursor
      const lastAtIndex = textUpToCursor.lastIndexOf('@'); // Find the last '@' symbol

      if (lastAtIndex === -1) return; // If there is no '@' symbol, we do nothing

      const newText = text.slice(0, lastAtIndex + 1) + username + ' ' + text.slice(cursorPosition); // Insert the mention in the text

      if (input.value !== newText) {
        // Update the text in the textarea if it has changed
        pluginApi.uiCommands?.chat.form.fill({
          text: newText,
        });
      }

      // Move the cursor to the end of the mention
      const newPosition = lastAtIndex + username.length + 2;
      input.setSelectionRange(newPosition, newPosition);

      setMentionState((prev) => ({ ...prev, isActive: false }));
    },
    [pluginApi],
  );

  // Handle the keydown event to navigate through the suggestions and insert a mention with the keyboard
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLTextAreaElement;
      if (!target || target.id !== 'message-input' || !mentionState.isActive) return;

      // Prevent the default behavior of the arrow keys and the enter key to avoid moving the cursor and sending the message
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setMentionState((prev) => ({
            ...prev,
            selectedIndex: prev.selectedIndex > 0 ? prev.selectedIndex - 1 : suggestions.length - 1,
          }));
          break;

        case 'ArrowUp':
          event.preventDefault();
          setMentionState((prev) => ({
            ...prev,
            selectedIndex: prev.selectedIndex < suggestions.length - 1 ? prev.selectedIndex + 1 : 0,
          }));
          break;

        case 'Enter':
          if (mentionState.isActive && suggestions.length > 0) {
            event.preventDefault();
            event.stopPropagation();
            const selectedSuggestion = suggestions[mentionState.selectedIndex];
            if (selectedSuggestion) {
              insertMention(selectedSuggestion);
            }
          }
          break;

        case 'Escape':
          setMentionState((prev) => ({ ...prev, isActive: false }));
          break;
      }
    },
    [mentionState.isActive, mentionState.selectedIndex, suggestions, insertMention],
  );

  const handleHover = useCallback((index: number) => {
    setMentionState((prev) => ({
      ...prev,
      selectedIndex: index,
    }));
  }, []);

  // Add event listeners to the document to handle the input and keydown events
  useEffect(() => {
    document.addEventListener('input', handleInput);
    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('input', handleInput);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [handleInput, handleKeyDown]);

  return {
    mentionState,
    suggestions,
    insertMention,
    closeSuggestions: () => setMentionState((prev) => ({ ...prev, isActive: false })),
    handleHover,
  };
};
