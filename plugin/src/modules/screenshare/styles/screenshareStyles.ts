/**
 * Generates the CSS for the screenshare overlay.
 *
 * When the local user is sharing their screen, BBB shows a small 25% preview
 * with a status message. This CSS enlarges the preview and styles the overlay
 * elements. The overlay positioning is handled dynamically by JS
 * (useScreenshareOverlay) because the video maintains a 16:9 aspect ratio
 * whose rendered size depends on the container dimensions.
 *
 * DOM structure inside `#screenshareContainer` (when sharing):
 * ```
 * #screenshareContainer              ← flex, centers children
 *   ├── div (corner slot – empty)
 *   ├── div (corner slot – expand button)
 *   ├── div (corner slot – empty)
 *   ├── div (corner slot – empty)
 *   ├── video#screenshareVideo       ← inline style 25%, overridden here
 *   └── div[data-test="isSharingScreen"]  ← positioned by JS over the video
 *        └── div.sc-beeQDc           ← status card
 *             └── h1                 ← "Vous partagez désormais votre écran"
 * ```
 *
 * The `[data-test="isSharingScreen"]` element only exists for the user who is
 * sharing. Viewers never see the overlay.
 */
export function getScreenshareOverlayCSS(): string {
  return `
        /* ── Make the container a positioning context ── */
        #screenshareContainer:has([data-test="isSharingScreen"]) {
            position: relative !important;
        }

        /* ── Enlarge the screenshare video preview ── */
        #screenshareContainer:has([data-test="isSharingScreen"]) #screenshareVideo {
            width: 85% !important;
            height: 85% !important;
            max-height: 85% !important;
            border-radius: 8px;
            transition: width 0.3s ease, height 0.3s ease, max-height 0.3s ease;
            z-index: 1;
        }

        /* ── Overlay base (position set dynamically by JS) ── */
        #screenshareContainer [data-test="isSharingScreen"] {
            position: absolute !important;
            background: rgba(0, 0, 0, 0.45);
            border-radius: 8px;
            z-index: 2;
            pointer-events: none;
            display: flex !important;
            align-items: center;
            justify-content: center;
            transition: top 0.3s ease, left 0.3s ease, width 0.3s ease, height 0.3s ease;
        }

        /* ── Status card styling ── */
        #screenshareContainer [data-test="isSharingScreen"] > div {
            background: rgba(0, 0, 0, 0.6);
            border-radius: 12px;
            backdrop-filter: blur(6px);
            padding: 0.8rem 1.5rem;
            pointer-events: auto;
        }

        /* ── Status text ── */
        #screenshareContainer [data-test="isSharingScreen"] h1 {
            color: #ffffff !important;
            font-size: 1.4rem !important;
            font-weight: 600;
            text-align: center;
            margin: 0;
        }

        /* ── Keep corner controls (expand button, etc.) above overlay ── */
        #screenshareContainer:has([data-test="isSharingScreen"]) > div:not([data-test="isSharingScreen"]) {
            z-index: 4;
            position: relative;
        }
    `;
}
