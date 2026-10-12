import { useEffect } from 'react';
import { PluginApi } from 'bigbluebutton-html-plugin-sdk';
import { ThemeService } from '../../../services/ThemeService';
import { BadgeStyle } from '../../../types/styles';

/**
 * Helper to create a Font Awesome badge element
 */
const createBadgeElement = (badge: BadgeStyle): HTMLElement => {
  const badgeEl = document.createElement('div');
  badgeEl.className = 'flowly-fa-badge';
  badgeEl.style.display = 'inline-flex';
  badgeEl.style.alignItems = 'center';
  badgeEl.style.justifyContent = 'center';
  badgeEl.style.marginLeft = '6px';
  badgeEl.style.flexShrink = '0';

  const icon = document.createElement('i');
  icon.className = `fas fa-${badge.iconName}`;
  icon.style.color = badge.color;
  icon.style.fontSize = '12px';

  badgeEl.appendChild(icon);
  return badgeEl;
};

export const useQuestionBadge = (pluginApi: PluginApi | null, questionMessageIds: string[]) => {
  useEffect(() => {
    const questionTheme = ThemeService.getQuestionColors();

    // Early return if module is disabled or theme is not available
    if (!questionTheme?.badge || !questionTheme.isEnabled) {
      return;
    }

    const findNameElement = (element: Element): HTMLElement | null => {
      if (
        element.children.length === 0 &&
        element instanceof HTMLElement &&
        !element.textContent?.match(/^\d{1,2}:\d{2}$/) &&
        element.closest('time') === null
      ) {
        return element;
      }

      for (const child of Array.from(element.children)) {
        const result = findNameElement(child);
        if (result) return result;
      }

      return null;
    };

    questionMessageIds.forEach((messageId) => {
      const messageEl = document.querySelector(
        `[data-chat-message-id="${messageId}"][role="listitem"]`,
      );
      if (!messageEl) return;

      // Navigate to the sequence container to reliably find the header
      const container = messageEl.closest('[data-sequence]');
      if (!container) return;

      // Skip if a question badge was already added in this container
      if (container.querySelector('[data-question-badge-added]')) return;

      // Find the avatar (div[color], not button[color]) and the adjacent name wrapper
      const avatar = container.querySelector('div[color]');
      if (!avatar?.nextElementSibling) return;

      const nameElement = findNameElement(avatar.nextElementSibling);
      if (!nameElement) return;

      const originalText = nameElement.textContent?.trim() || '';
      nameElement.textContent = '';

      const textSpan = document.createElement('span');
      textSpan.textContent = originalText;
      nameElement.appendChild(textSpan);

      const badgeEl = createBadgeElement(questionTheme.badge!);
      nameElement.appendChild(badgeEl);

      nameElement.style.display = 'flex';
      nameElement.style.alignItems = 'center';
      nameElement.style.gap = '4px';
      nameElement.dataset.questionBadgeAdded = 'true';
    });
  }, [questionMessageIds]);
};
