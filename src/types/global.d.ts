/**
 * Global type declarations for Flowly Plugin
 * These variables are injected at build time by Webpack DefinePlugin
 */

declare const FLOWLY_API_URL: string | undefined;
declare const NODE_ENV: string | undefined;
declare const GIPHY_API_KEY: string | undefined;

/** Type declarations for throttle-debounce (transitive dependency of @giphy/react-components) */
declare module 'throttle-debounce' {
  interface Cancel {
    cancel: () => void;
  }
  type debounce<T extends (...args: unknown[]) => unknown> = T & Cancel;
  type throttle<T extends (...args: unknown[]) => unknown> = T & Cancel;
}
