import { useEffect, useRef } from 'react';
import { getGifButtonStyle, getThemeColors } from '../styles/gifStyles';

/** DOM attribute marker to prevent duplicate button injection */
const GIF_BUTTON_MARKER = 'data-gif-button-added';

/**
 * Hook that injects a GIF button into the BBB chat input area.
 * Uses MutationObserver to re-inject the button if the DOM is rebuilt.
 * Pass `null` for onToggle to disable button injection entirely.
 *
 * @param onToggle - Callback invoked when the GIF button is clicked, or null to skip injection
 * @param isPickerOpen - Whether the picker is currently open (for visual feedback)
 */
export const useGifButton = (onToggle: (() => void) | null, isPickerOpen: boolean) => {
  const onToggleRef = useRef(onToggle);
  const isPickerOpenRef = useRef(isPickerOpen);

  // Keep refs in sync with latest values
  useEffect(() => {
    onToggleRef.current = onToggle;
  }, [onToggle]);

  useEffect(() => {
    isPickerOpenRef.current = isPickerOpen;
  }, [isPickerOpen]);

  useEffect(() => {
    // Skip injection when no toggle callback is provided (API key missing)
    if (!onToggleRef.current) return;
    /**
     * Creates and injects the GIF button element next to the chat textarea
     */
    const injectButton = () => {
      const messageInput = document.getElementById('message-input');
      if (!messageInput) return;

      const formContainer = messageInput.closest('form') ?? messageInput.parentElement;
      if (!formContainer || formContainer.hasAttribute(GIF_BUTTON_MARKER)) return;

      // Find the send button or actions area to insert before
      const actionsArea =
        formContainer.querySelector('button[type="submit"]')?.parentElement ?? formContainer;

      const button = document.createElement('button');
      button.type = 'button';
      button.title = 'GIF';
      button.setAttribute('data-gif-trigger', 'true');

      // Apply styles
      const styles = getGifButtonStyle();
      Object.assign(button.style, styles);

      // Create the GIF label using safe DOM methods
      const label = document.createElement('span');
      label.textContent = 'GIF';
      label.style.fontWeight = '700';
      label.style.fontSize = '13px';
      label.style.letterSpacing = '0.5px';
      button.appendChild(label);

      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggleRef.current?.();
      });

      // Insert the button before the send button area
      if (actionsArea !== formContainer && actionsArea.parentElement === formContainer) {
        formContainer.insertBefore(button, actionsArea);
      } else {
        // Fallback: append next to the textarea
        messageInput.parentElement?.appendChild(button);
      }

      formContainer.setAttribute(GIF_BUTTON_MARKER, 'true');
    };

    // Initial injection attempt
    injectButton();

    // Observe DOM changes to re-inject if needed. BBB tears down and rebuilds
    // the whole chat panel when it is hidden then re-shown, so we observe a
    // stable root (document.body) rather than the disposable chat container —
    // otherwise the observer ends up watching a detached node and never fires
    // again, and the button is lost for good.
    const observer = new MutationObserver(() => {
      // Cheap short-circuit: nothing to do while the chat input is absent.
      const messageInput = document.getElementById('message-input');
      if (!messageInput) return;

      // Button-presence check scoped to the form (avoids a full-DOM query).
      const formContainer = messageInput.closest('form') ?? messageInput.parentElement;
      if (!formContainer || formContainer.querySelector('[data-gif-trigger]')) return;

      // Chat is present but the button is gone (panel was rebuilt) — re-inject.
      formContainer.removeAttribute(GIF_BUTTON_MARKER);
      injectButton();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      const button = document.querySelector('[data-gif-trigger]');
      button?.remove();
      const formContainer =
        document.getElementById('message-input')?.closest('form') ??
        document.getElementById('message-input')?.parentElement;
      formContainer?.removeAttribute(GIF_BUTTON_MARKER);
    };
  }, []);

  // Update button visual state when picker opens/closes
  useEffect(() => {
    const button = document.querySelector('[data-gif-trigger]') as HTMLElement | null;
    if (button) {
      const { primaryColor } = getThemeColors();
      button.style.opacity = isPickerOpen ? '0.7' : '1';
      button.style.color = primaryColor;
    }
  }, [isPickerOpen]);
};
