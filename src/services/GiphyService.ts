import { GiphyFetch } from '@giphy/js-fetch-api';
import { config } from '../config/constants';

/**
 * Singleton service managing Giphy API interactions.
 * Provides search and trending GIF fetching via the Giphy SDK.
 */
export class GiphyService {
  private static instance: GiphyService;
  private giphyFetch: GiphyFetch | null = null;

  private constructor() {
    const apiKey = config.giphyApiKey;
    if (apiKey) {
      this.giphyFetch = new GiphyFetch(apiKey);
    } else {
      // eslint-disable-next-line no-console
      console.warn('GiphyService: No API key configured, GIF features will be disabled');
    }
  }

  /**
   * Returns the singleton instance of GiphyService
   */
  public static getInstance(): GiphyService {
    if (!GiphyService.instance) {
      GiphyService.instance = new GiphyService();
    }
    return GiphyService.instance;
  }

  /**
   * Checks if the Giphy API is properly configured
   */
  public static isAvailable(): boolean {
    return GiphyService.getInstance().giphyFetch !== null;
  }

  /**
   * Returns the Giphy API key for use with SearchContextManager
   */
  public static getApiKey(): string {
    return config.giphyApiKey;
  }

  /**
   * Returns the GiphyFetch instance for direct API calls
   */
  public static getFetchInstance(): GiphyFetch | null {
    return GiphyService.getInstance().giphyFetch;
  }
}
