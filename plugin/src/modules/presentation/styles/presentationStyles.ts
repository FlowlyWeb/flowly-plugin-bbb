import { Colors } from '../../shared/utils/colors';

/**
 * CSS to theme presentation download messages in the chat
 * with the company primary color.
 *
 * Overrides:
 * - `border-left` on the message wrapper → `primaryColor`
 * - `background-color` on the icon circle → `primaryColor`
 * - `color` on the icon → contrast color (white or black)
 *
 * @param primaryColor - The company primary color from ThemeService
 */
export function getPresentationChatCSS(primaryColor: string): string {
  const iconColor = Colors.getContrastColor(primaryColor);
  return `
        /* ── Presentation download message — border accent ── */
        [data-message-type="presentation"] .sc-fJKILO {
            border-left-color: ${primaryColor} !important;
        }

        /* ── Presentation download message — icon background ── */
        [data-message-type="presentation"] .sc-fsJXci {
            background-color: ${primaryColor} !important;
            color: ${iconColor} !important;
        }
    `;
}

/**
 * CSS styles for the custom "⋮" dropdown injected into the BBB upload modal.
 *
 * All rules use `!important` to prevent BBB/MUI style overrides.
 * The dropdown is rendered on `document.body` with `position: fixed`
 * to avoid clipping by parent `overflow: hidden` containers.
 */
export function getPresentationUploadCSS(): string {
  return `
        /* ── Hide the native disabled "⋮" button ── */
        [data-flowly-hidden="true"] {
            display: none !important;
        }

        /* ── Custom "⋮" button (replaces the hidden native one) ── */
        button.flowly-export-btn {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            background: none !important;
            border: none !important;
            cursor: pointer !important;
            padding: 6px !important;
            border-radius: 4px !important;
            color: inherit !important;
        }

        button.flowly-export-btn:hover {
            background: rgba(0, 0, 0, 0.08) !important;
        }

        button.flowly-export-btn i {
            font-size: 1rem !important;
            pointer-events: none !important;
        }

        /* ── Dropdown menu (rendered on document.body, position: fixed) ── */
        div.flowly-dropdown {
            position: fixed !important;
            z-index: 99999 !important;
            min-width: 300px !important;
            background: #fff !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.18) !important;
            padding: 4px 0 !important;
            overflow: visible !important;
        }

        /* ── Dropdown item ── */
        button.flowly-dropdown-item {
            display: flex !important;
            align-items: flex-start !important;
            width: 100% !important;
            padding: 12px 16px !important;
            border: none !important;
            background: none !important;
            text-align: left !important;
            cursor: pointer !important;
            font-size: 14px !important;
            color: #1a202c !important;
            line-height: 1.4 !important;
            font-family: inherit !important;
        }

        button.flowly-dropdown-item:hover {
            background: rgba(0, 0, 0, 0.06) !important;
        }

        /* ── Selected state (checkmark visible) ── */
        button.flowly-dropdown-item--selected {
            background: rgba(0, 128, 0, 0.06) !important;
        }

        /* ── Checkmark placeholder ── */
        span.flowly-dropdown-check {
            display: inline-block !important;
            width: 20px !important;
            font-size: 14px !important;
            color: #16a34a !important;
            flex-shrink: 0 !important;
        }

        /* ── Backdrop to close dropdown when clicking outside ── */
        div.flowly-dropdown-backdrop {
            position: fixed !important;
            inset: 0 !important;
            z-index: 99998 !important;
            background: transparent !important;
        }
    `;
}
