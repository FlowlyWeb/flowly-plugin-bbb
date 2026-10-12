import { useEffect, useRef, useCallback } from 'react';
import { LayoutPresentationAreaUiDataNames, UiLayouts } from 'bigbluebutton-html-plugin-sdk';
import { usePluginContext } from '../../core/plugin/PluginContext';
import { DOMStyleService } from '../../../services/DOMStyleService';
import { getScreenshareOverlayCSS } from '../styles/screenshareStyles';

/** Unique identifier for the injected stylesheet. */
const STYLE_ID = 'screenshare-overlay-styles';

/** Selector for the element that only exists for the user who is sharing. */
const SHARING_INDICATOR_SELECTOR = '[data-test="isSharingScreen"]';

/** Container element that holds the screenshare video. */
const CONTAINER_SELECTOR = '#screenshareContainer';

/** The screenshare video element. */
const VIDEO_SELECTOR = '#screenshareVideo';

/** Delay (ms) before retrying when the container is not yet in the DOM. */
const RETRY_DELAY_MS = 200;

/**
 * Positions the overlay element exactly on top of the rendered video.
 *
 * The video has a 16:9 aspect ratio and is centered by flexbox inside
 * `#screenshareContainer`. Its rendered size varies depending on the
 * available space, so we read its actual bounding box relative to the
 * container and apply pixel values to the overlay.
 */
function positionOverlayOnVideo(container: Element, video: Element, overlay: HTMLElement): void {
  const containerRect = container.getBoundingClientRect();
  const videoRect = video.getBoundingClientRect();

  const top = videoRect.top - containerRect.top;
  const left = videoRect.left - containerRect.left;

  overlay.style.top = `${top}px`;
  overlay.style.left = `${left}px`;
  overlay.style.width = `${videoRect.width}px`;
  overlay.style.height = `${videoRect.height}px`;
}

/**
 * Detects when the local user is sharing their screen and injects an overlay
 * CSS to improve the preview visibility. The overlay is positioned
 * dynamically via JS to match the video's actual rendered dimensions
 * (which depend on its 16:9 aspect ratio and the available container space).
 *
 * Detection strategy (hybrid SDK + DOM):
 * 1. SDK tells us the presentation area is showing SCREEN_SHARE.
 * 2. DOM element `[data-test="isSharingScreen"]` only exists for the sharer.
 * 3. Both conditions must be true to inject the overlay.
 *
 * On BBB 3.0 (older SDK without `useUiData`), the hook stays inactive.
 */
export function useScreenshareOverlay(): void {
  const { pluginApi } = usePluginContext();
  const observerRef = useRef<MutationObserver | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── SDK: detect SCREEN_SHARE layout ──────────────────────────────
  // `useUiData` is optional in older SDK versions; guard with `?.`
  const layoutData = pluginApi?.useUiData?.(LayoutPresentationAreaUiDataNames.CURRENT_ELEMENT, [
    { isOpen: false },
  ]);

  const isScreenshareActive =
    Array.isArray(layoutData) &&
    layoutData.some((item) => item.currentElement === UiLayouts.SCREEN_SHARE && item.isOpen);

  /**
   * Disconnects all observers and clears any pending retry timer.
   */
  const cleanup = useCallback((): void => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // ── CSS injection + overlay positioning based on SDK + DOM state ──
  useEffect(() => {
    /**
     * Checks the DOM for the sharing indicator, injects/removes CSS,
     * and positions the overlay on top of the video.
     */
    const syncOverlay = (): void => {
      const container = document.querySelector(CONTAINER_SELECTOR);
      const video = document.querySelector(VIDEO_SELECTOR);
      const overlay = document.querySelector(SHARING_INDICATOR_SELECTOR) as HTMLElement | null;

      if (!overlay) {
        DOMStyleService.removeStyleSheet(STYLE_ID);
        return;
      }

      // Inject the stylesheet (idempotent if already present)
      DOMStyleService.createStyleSheet(STYLE_ID, getScreenshareOverlayCSS());

      // Position the overlay exactly on top of the video
      if (container && video) {
        positionOverlayOnVideo(container, video, overlay);
      }
    };

    /**
     * Sets up observers to react to DOM mutations and container resizes.
     */
    const setupObservers = (): void => {
      cleanup();

      const container = document.querySelector(CONTAINER_SELECTOR);

      if (!container) {
        // Container not yet rendered – retry after a short delay
        retryTimerRef.current = setTimeout(setupObservers, RETRY_DELAY_MS);
        return;
      }

      // Initial sync
      syncOverlay();

      // MutationObserver: react when isSharingScreen element appears/disappears
      observerRef.current = new MutationObserver(syncOverlay);
      observerRef.current.observe(container, {
        childList: true,
        subtree: true,
      });

      // ResizeObserver: reposition overlay when container is resized
      resizeObserverRef.current = new ResizeObserver(syncOverlay);
      resizeObserverRef.current.observe(container);
    };

    if (!isScreenshareActive) {
      DOMStyleService.removeStyleSheet(STYLE_ID);
      cleanup();
      return;
    }

    setupObservers();

    return () => {
      DOMStyleService.removeStyleSheet(STYLE_ID);
      cleanup();
    };
  }, [isScreenshareActive, cleanup]);
}
