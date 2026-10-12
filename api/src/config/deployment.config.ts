/**
 * Deployment mode configuration
 *
 * Centralized configuration for deployment mode detection.
 * Replaces the inconsistent use of ENVIRONMENT and DEPLOYMENT_MODE variables.
 *
 * @example
 * ```typescript
 * import { DeploymentConfig, DEPLOYMENT_MODES } from '@/config/deployment.config';
 *
 * if (DeploymentConfig.isOnPremise) {
 *   // On-premise specific logic
 * }
 * ```
 */

/**
 * Available deployment modes
 */
export const DEPLOYMENT_MODES = {
  ONPREMISE: 'onpremise',
  SAAS: 'saas',
} as const;

/**
 * Deployment mode type
 */
export type DeploymentMode = (typeof DEPLOYMENT_MODES)[keyof typeof DEPLOYMENT_MODES];

/**
 * Deployment configuration service
 *
 * Singleton class that provides type-safe access to deployment mode.
 * Validates the deployment mode on initialization.
 */
class DeploymentConfigService {
  private readonly mode: DeploymentMode;

  constructor() {
    const envMode = process.env.DEPLOYMENT_MODE;

    // Default to 'saas' if not specified
    if (!envMode) {
      this.mode = DEPLOYMENT_MODES.SAAS;
      return;
    }

    if (!this.isValidMode(envMode)) {
      throw new Error(
        `Invalid DEPLOYMENT_MODE: "${envMode}". ` +
          `Must be "${DEPLOYMENT_MODES.ONPREMISE}" or "${DEPLOYMENT_MODES.SAAS}"`,
      );
    }

    this.mode = envMode as DeploymentMode;
  }

  /**
   * Check if the given mode is a valid deployment mode
   */
  private isValidMode(mode: string): mode is DeploymentMode {
    return Object.values(DEPLOYMENT_MODES).includes(mode as DeploymentMode);
  }

  /**
   * Get the current deployment mode
   */
  get current(): DeploymentMode {
    return this.mode;
  }

  /**
   * Check if running in on-premise mode
   */
  get isOnPremise(): boolean {
    return this.mode === DEPLOYMENT_MODES.ONPREMISE;
  }

  /**
   * Check if running in SaaS mode
   */
  get isSaaS(): boolean {
    return this.mode === DEPLOYMENT_MODES.SAAS;
  }
}

/**
 * Singleton instance of DeploymentConfigService
 *
 * Initialized once at application startup.
 */
export const DeploymentConfig = new DeploymentConfigService();
