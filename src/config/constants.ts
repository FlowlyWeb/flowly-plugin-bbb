/**
 * Flowly Plugin Configuration
 *
 * Determines the API endpoint based on environment variables set at build time.
 * - SaaS: Points to https://api.flowlyweb.com
 * - On-Premise: Points to client's API (e.g., http://client-domain:3000)
 * - Development: Uses local API (can be overridden with window.FLOWLY_API_URL)
 */

declare global {
  interface Window {
    FLOWLY_API_URL?: string;
  }
}

/**
 * Environment variables injected at build time via Webpack DefinePlugin
 * These are replaced by actual values during the build process
 */
declare const FLOWLY_API_URL: string | undefined;
declare const NODE_ENV: string | undefined;
declare const GIPHY_API_KEY: string | undefined;

/**
 * Determine API base URL based on environment configuration
 */
function getApiUrl(): string {
  // 1. Manual override for testing (highest priority)
  if (window.FLOWLY_API_URL) {
    return window.FLOWLY_API_URL;
  }

  // 2. Environment variable set at build time
  if (typeof FLOWLY_API_URL !== 'undefined' && FLOWLY_API_URL) {
    return FLOWLY_API_URL;
  }

  // 3. Development fallback
  if (typeof NODE_ENV !== 'undefined' && NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }

  // 4. Default fallback (should not happen in production)
  // eslint-disable-next-line no-console
  console.warn('FLOWLY_API_URL not configured, using default');
  return 'http://localhost:3000';
}

/**
 * Determine Giphy API key from build-time environment variable
 */
function getGiphyApiKey(): string {
  if (typeof GIPHY_API_KEY !== 'undefined' && GIPHY_API_KEY) {
    return GIPHY_API_KEY;
  }

  // Development fallback (Giphy public beta key)
  if (typeof NODE_ENV !== 'undefined' && NODE_ENV === 'development') {
    return '';
  }

  return '';
}

export const config = {
  baseUrl: `${getApiUrl()}/api`,
  giphyApiKey: getGiphyApiKey(),
};
