import { useEffect, useRef, useState } from 'react';
import { usePluginContext } from '../../core/plugin/PluginContext';
import {
  GIPHY_URL_PATTERN,
  GIF_INLINE_MAX_WIDTH,
  GIF_INLINE_BORDER_RADIUS,
} from '../styles/gifStyles';

/** DOM attribute marker to prevent duplicate GIF rendering */
const GIF_RENDERED_MARKER = 'data-gif-rendered';

/**
 * Hook that detects GIF URLs in chat messages and renders them inline as images.
 * Uses the BBB plugin SDK `useChatMessageDomElements` to access message DOM elements,
 * and `useLoadedChatMessages` to scan message content for GIF URLs.
 *
 * @param enabled - Whether GIF rendering is active (controlled by module toggle)
 */
export const useGifRenderer = (enabled: boolean) => {
  const { pluginApi } = usePluginContext();
  const chatMessages = pluginApi?.useLoadedChatMessages?.();
  const [gifMessageIds, setGifMessageIds] = useState<string[]>([]);
  const gifUrlMap = useRef<Map<string, string>>(new Map());

  // Step 1: Scan messages and identify those containing GIF URLs
  useEffect(() => {
    if (!enabled || !chatMessages?.data) return;

    const newGifIds: string[] = [];

    chatMessages.data.forEach((msg) => {
      if (!msg.message) return; // Skip deleted messages

      // Check for GIF URL in message text
      const gifUrl = extractGifUrl(msg.message);
      // Check messageMetadata for GIF type
      const metaGifUrl = extractGifUrlFromMeta(msg.messageMetadata);

      const url = gifUrl ?? metaGifUrl;
      if (url) {
        newGifIds.push(msg.messageId);
        gifUrlMap.current.set(msg.messageId, url);
      }
    });

    setGifMessageIds(newGifIds);
  }, [chatMessages?.data, enabled]);

  // Step 2: Get DOM elements for identified GIF messages via SDK
  const domElements = pluginApi?.useChatMessageDomElements?.(gifMessageIds);

  // Step 3: Inject GIF images into the DOM elements
  useEffect(() => {
    if (!domElements || domElements.length === 0) return;

    domElements.forEach((element) => {
      if (!element || element.hasAttribute(GIF_RENDERED_MARKER)) return;

      // Find which message ID this element corresponds to
      const messageId =
        element.getAttribute('data-chat-message-id') ??
        gifMessageIds.find((id) => {
          const el = element.querySelector(`[data-chat-message-id="${id}"]`);
          return el !== null;
        });

      if (!messageId) return;

      const url = gifUrlMap.current.get(messageId);
      if (!url) return;

      // Find the message content area
      const contentEl = findMessageContentElement(element);
      if (!contentEl) return;

      // Create and insert the GIF image
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'GIF';
      img.loading = 'lazy';
      img.style.maxWidth = `${GIF_INLINE_MAX_WIDTH}px`;
      img.style.width = '100%';
      img.style.height = 'auto';
      img.style.borderRadius = `${GIF_INLINE_BORDER_RADIUS}px`;
      img.style.cursor = 'pointer';
      img.style.display = 'block';
      img.style.marginTop = '4px';

      // Open GIF in new tab on click
      img.addEventListener('click', () => {
        window.open(url, '_blank', 'noopener,noreferrer');
      });

      contentEl.appendChild(img);

      // Hide the raw URL text in the message
      hideUrlText(contentEl, url);

      element.setAttribute(GIF_RENDERED_MARKER, 'true');
    });
  }, [domElements, gifMessageIds]);
};

/**
 * Extracts the first Giphy/Tenor GIF URL from a message string
 */
function extractGifUrl(message: string): string | null {
  if (!message) return null;

  const match = message.match(GIPHY_URL_PATTERN);
  return match ? match[0] : null;
}

/**
 * Extracts a GIF URL from plugin custom metadata JSON
 */
function extractGifUrlFromMeta(metadata: string | undefined): string | null {
  if (!metadata) return null;

  try {
    const parsed = JSON.parse(metadata);
    if (parsed.type === 'gif' && parsed.gifUrl) {
      return parsed.gifUrl;
    }
  } catch {
    // Invalid JSON metadata, ignore
  }

  return null;
}

/**
 * Finds the message content element within a chat message DOM node.
 * Navigates the BBB message structure to locate the text container.
 */
function findMessageContentElement(messageEl: Element): Element | null {
  // Look for the element containing the actual message text
  const contentCandidates = Array.from(messageEl.querySelectorAll('p, span'));
  for (const candidate of contentCandidates) {
    if (candidate.textContent && candidate.textContent.trim().length > 0) {
      return candidate.parentElement ?? candidate;
    }
  }

  // Fallback: use the message element itself
  return messageEl;
}

/**
 * Hides the raw URL text in the message content if the message
 * consists primarily of the GIF URL
 */
function hideUrlText(contentEl: Element, gifUrl: string): void {
  const textNodes = getTextNodes(contentEl);
  for (const node of textNodes) {
    if (node.textContent?.includes(gifUrl)) {
      const span = document.createElement('span');
      span.style.display = 'none';
      span.textContent = node.textContent;
      node.parentNode?.replaceChild(span, node);
      break;
    }
  }
}

/**
 * Returns all text nodes within an element
 */
function getTextNodes(element: Element): Text[] {
  const textNodes: Text[] = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }
  return textNodes;
}
