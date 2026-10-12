import { useCallback, useEffect, useState } from 'react';
import { GifPickerState } from '../../../types/gif';

/**
 * Hook managing the GIF picker open/close state and position.
 * Handles Escape key and click-outside to close the picker.
 */
export const useGifPicker = () => {
  const [pickerState, setPickerState] = useState<GifPickerState>({
    isOpen: false,
    position: null,
  });

  /**
   * Toggles the picker visibility and computes its position
   * relative to the chat input area
   */
  const togglePicker = useCallback(() => {
    setPickerState((prev) => {
      if (prev.isOpen) {
        return { isOpen: false, position: null };
      }

      const messageInput = document.getElementById('message-input');
      const formContainer = messageInput?.closest('form') ?? messageInput?.parentElement;

      if (!formContainer) {
        return { isOpen: false, position: null };
      }

      const formRect = formContainer.getBoundingClientRect();

      return {
        isOpen: true,
        position: {
          top: formRect.top,
          left: formRect.left,
          width: formRect.width,
        },
      };
    });
  }, []);

  /**
   * Closes the picker
   */
  const closePicker = useCallback(() => {
    setPickerState({ isOpen: false, position: null });
  }, []);

  /**
   * Close on Escape key press
   */
  useEffect(() => {
    if (!pickerState.isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePicker();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [pickerState.isOpen, closePicker]);

  return {
    pickerState,
    togglePicker,
    closePicker,
  };
};
