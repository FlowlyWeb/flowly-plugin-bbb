/**
 * Service responsible for injecting a custom "⋮" button and dropdown menu
 * into each presentation item row of the BBB 3.0 upload modal.
 *
 * The native "⋮" button is disabled by BBB until the file is uploaded.
 * This service hides the native button and replaces it with a custom one
 * that opens a dropdown with the same options, allowing the user to
 * configure download settings before uploading.
 */

/** Marker attribute for rows that have already been enhanced. */
const ENHANCED_MARKER = 'data-flowly-enhanced';

/** Native "⋮" button selector. */
const NATIVE_BTN_SELECTOR = '[data-test="presentationOptionsDownload"]';

/**
 * Dropdown option definition.
 */
interface DropdownOption {
  label: string;
  dataTest: string;
}

/** The options shown in the custom dropdown. */
const DROPDOWN_OPTIONS: DropdownOption[] = [
  {
    label: 'Activer le téléchargement de la présentation (pdf)',
    dataTest: 'enableOriginalPresentationDownload',
  },
  {
    label: 'Envoyer un lien de téléchargement pour la présentation dans son état actuel',
    dataTest: 'sendCurrentStateDocument',
  },
];

/**
 * Callback invoked when the user selects a dropdown option.
 *
 * @param fileName  - The presentation filename from the row
 * @param dataTest  - The `data-test` value identifying the action
 */
type OnOptionSelected = (fileName: string, dataTest: string) => void;

export class PresentationDOMService {
  /**
   * Enhances a single presentation item row by hiding the native "⋮"
   * button and injecting a custom one with a dropdown menu.
   *
   * @param row              - The `<tr data-test="presentationItem">` element
   * @param onOptionSelected - Callback for when a dropdown option is clicked
   */
  static enhanceRow(row: Element, onOptionSelected: OnOptionSelected): void {
    if (row.hasAttribute(ENHANCED_MARKER)) return;
    row.setAttribute(ENHANCED_MARKER, 'true');

    // Find and hide the native disabled "⋮" button's wrapper
    const nativeBtn = row.querySelector(NATIVE_BTN_SELECTOR);
    const nativeBtnWrapper = nativeBtn?.closest('div[tabindex]');
    if (nativeBtnWrapper) {
      (nativeBtnWrapper as HTMLElement).setAttribute('data-flowly-hidden', 'true');
    }

    // Extract filename from the row
    const fileName = PresentationDOMService.getFileName(row);

    // Create custom "⋮" button
    const customBtn = PresentationDOMService.createExportButton(fileName, onOptionSelected, row);

    // Insert the custom button where the native one was
    const actionsContainer = nativeBtnWrapper?.parentElement;
    if (actionsContainer) {
      actionsContainer.insertBefore(customBtn, nativeBtnWrapper);
    }
  }

  /**
   * Extracts the presentation filename from a row.
   *
   * BBB 3.0 DOM: `<th colspan="..."><span>filename.pdf</span></th>`
   */
  static getFileName(row: Element): string {
    const nameEl = row.querySelector('th[colspan] > span') ?? row.querySelector('th > span');
    return nameEl?.textContent?.trim() ?? '';
  }

  /**
   * Creates a custom "⋮" button that opens a dropdown menu on click.
   *
   * @param fileName          - The filename associated with this button
   * @param onOptionSelected  - Callback for dropdown option selection
   * @param row               - The presentation row element (stores selection state)
   */
  private static createExportButton(
    fileName: string,
    onOptionSelected: OnOptionSelected,
    row: Element,
  ): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'inline-block';

    const btn = document.createElement('button');
    btn.className = 'flowly-export-btn';
    btn.setAttribute('type', 'button');
    btn.setAttribute('aria-label', 'Exporter les options');
    btn.title = 'Exporter les options';

    // Reuse the same icon class as BBB
    const icon = document.createElement('i');
    icon.className = 'sc-koXPp cyfQlK sc-kOPcWz hmmQvn icon-bbb-more';
    btn.appendChild(icon);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      // Close any existing dropdown first
      PresentationDOMService.closeAllDropdowns();

      // Position the dropdown relative to the button using fixed positioning
      const rect = btn.getBoundingClientRect();

      const dropdown = PresentationDOMService.createDropdown(fileName, onOptionSelected, row);
      dropdown.style.top = `${rect.bottom + 4}px`;
      dropdown.style.left = `${rect.right}px`;
      dropdown.style.transform = 'translateX(-100%)';

      // Render dropdown on document.body to avoid overflow clipping
      document.body.appendChild(dropdown);

      // Create backdrop to close on outside click
      const backdrop = document.createElement('div');
      backdrop.className = 'flowly-dropdown-backdrop';
      backdrop.addEventListener('click', () => {
        PresentationDOMService.closeAllDropdowns();
      });
      document.body.appendChild(backdrop);
    });

    wrapper.appendChild(btn);
    return wrapper;
  }

  /**
   * Creates the dropdown menu element with all options.
   * Previously selected options are shown with a checkmark.
   *
   * @param fileName          - The presentation filename
   * @param onOptionSelected  - Callback for dropdown option selection
   * @param row               - The presentation row element (stores selection state)
   */
  private static createDropdown(
    fileName: string,
    onOptionSelected: OnOptionSelected,
    row: Element,
  ): HTMLElement {
    const dropdown = document.createElement('div');
    dropdown.className = 'flowly-dropdown';

    for (const option of DROPDOWN_OPTIONS) {
      const isSelected = row.hasAttribute(`data-flowly-${option.dataTest}`);

      const item = document.createElement('button');
      item.className = `flowly-dropdown-item${isSelected ? ' flowly-dropdown-item--selected' : ''}`;
      item.setAttribute('type', 'button');
      item.setAttribute('data-test', option.dataTest);

      // Prepend checkmark for selected items
      const checkmark = document.createElement('span');
      checkmark.className = 'flowly-dropdown-check';
      checkmark.textContent = isSelected ? '✓' : '';
      item.appendChild(checkmark);

      const label = document.createElement('span');
      label.textContent = option.label;
      item.appendChild(label);

      item.addEventListener('click', (e) => {
        e.stopPropagation();

        // Toggle selection state on the row
        if (isSelected) {
          row.removeAttribute(`data-flowly-${option.dataTest}`);
        } else {
          row.setAttribute(`data-flowly-${option.dataTest}`, 'true');
        }

        onOptionSelected(fileName, option.dataTest);
        PresentationDOMService.closeAllDropdowns();
      });

      dropdown.appendChild(item);
    }

    return dropdown;
  }

  /**
   * Closes all open custom dropdowns and their backdrops.
   */
  static closeAllDropdowns(): void {
    document.querySelectorAll('.flowly-dropdown').forEach((el) => el.remove());
    document.querySelectorAll('.flowly-dropdown-backdrop').forEach((el) => el.remove());
  }

  /**
   * Removes all injected elements and restores hidden native buttons.
   */
  static removeAllInjections(): void {
    // Remove custom buttons
    document.querySelectorAll('.flowly-export-btn').forEach((el) => {
      el.closest('div')?.remove();
    });

    // Restore hidden native buttons
    document.querySelectorAll('[data-flowly-hidden="true"]').forEach((el) => {
      el.removeAttribute('data-flowly-hidden');
    });

    // Reset enhanced markers
    document.querySelectorAll(`[${ENHANCED_MARKER}]`).forEach((el) => {
      el.removeAttribute(ENHANCED_MARKER);
    });

    PresentationDOMService.closeAllDropdowns();
  }
}
