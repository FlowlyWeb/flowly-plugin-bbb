/**
 * Service for managing favicon injection in the BigBlueButton interface
 *
 * This service handles the creation and removal of custom favicon links
 * in the document head, allowing institutions and workspaces to customize
 * the browser tab icon.
 */
export class FaviconService {
  private static faviconLinks = new Map<string, HTMLLinkElement>();

  /**
   * Creates or updates a favicon link element
   *
   * @param id - Unique identifier for this favicon
   * @param url - Favicon URL (can be base64 data URI or regular URL)
   */
  static createFavicon(id: string, url: string): void {
    // Check if a favicon with this ID already exists
    const existingCustomFavicon = this.faviconLinks.get(id);
    if (existingCustomFavicon) {
      existingCustomFavicon.href = url;
      return;
    }

    // Find existing favicon link in document
    const existingFavicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (existingFavicon) {
      // Update existing favicon
      existingFavicon.href = url;
      this.faviconLinks.set(id, existingFavicon);
      return;
    }

    // Create new favicon link if none exists
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/x-icon';
    link.href = url;
    document.head.appendChild(link);
    this.faviconLinks.set(id, link);
  }

  /**
   * Removes a favicon link element
   *
   * @param id - Unique identifier of the favicon to remove
   */
  static removeFavicon(id: string): void {
    const link = this.faviconLinks.get(id);
    if (link && document.head.contains(link)) {
      // Don't remove the link element, just clear our reference
      // This prevents removing the original BBB favicon
      this.faviconLinks.delete(id);
    }
  }

  /**
   * Checks if a custom favicon is currently active
   *
   * @param id - Unique identifier to check
   * @returns true if the favicon exists and is in the document
   */
  static hasFavicon(id: string): boolean {
    const link = this.faviconLinks.get(id);
    return link !== undefined && document.head.contains(link);
  }
}
