/**
 * Service responsible for managing dynamic style sheets in the DOM
 * Handles the technical aspects of injecting and removing CSS
 */
export class DOMStyleService {
  private static styleSheets = new Map<string, HTMLStyleElement>();

  /**
   * Creates or updates a style sheet in the document head
   * @param id - Unique identifier for the style sheet
   * @param css - CSS content to inject
   */
  static createStyleSheet(id: string, css: string): void {
    const existingSheet = this.styleSheets.get(id);
    if (existingSheet) {
      existingSheet.textContent = css;
      return;
    }

    const styleSheet = document.createElement('style');
    styleSheet.textContent = css;
    document.head.appendChild(styleSheet);
    this.styleSheets.set(id, styleSheet);
  }

  /**
   * Removes a style sheet from the document head
   * @param id - Identifier of the style sheet to remove
   */
  static removeStyleSheet(id: string): void {
    const styleSheet = this.styleSheets.get(id);
    if (styleSheet && document.head.contains(styleSheet)) {
      document.head.removeChild(styleSheet);
      this.styleSheets.delete(id);
    }
  }

  /**
   * Checks if a style sheet exists
   * @param id - Identifier of the style sheet
   */
  static hasStyleSheet(id: string): boolean {
    return this.styleSheets.has(id);
  }

  /**
   * Cleans up all managed style sheets
   * Useful when needing to reset the styling state
   */
  static clearAllStyleSheets(): void {
    this.styleSheets.forEach((sheet, id) => {
      this.removeStyleSheet(id);
    });
  }
}
