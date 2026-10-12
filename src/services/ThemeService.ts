import {
  CompanyColors,
  Styles,
  QuestionThemeColors,
  ModeratorThemeColors,
  ThemeColors,
} from '../types/styles';
import { apiService } from './apiService';

type ModuleName = 'questions' | 'mentions' | 'moderator' | 'gif' | 'usernames';

/**
 * Central service managing theme configuration and module states
 * Implements singleton pattern for consistent state management
 */
export class ThemeService {
  private static instance: ThemeService;
  private styles: Styles;
  private initialized: boolean = false;

  private constructor() {
    this.styles = apiService.getDefaultStyles();
  }

  public static getInstance(): ThemeService {
    if (!ThemeService.instance) {
      ThemeService.instance = new ThemeService();
    }
    return ThemeService.instance;
  }

  /**
   * Initializes the service with current theme configuration
   * Fetches styles from the API, scoped to the workspace code (if any) read from
   * the plugin script URL (?workspace=<code>), injected by BBB via the
   * ${plugin_FlowlyPlugin_workspace:} substitution in manifest.json.
   */
  public static async initialize(): Promise<void> {
    const instance = ThemeService.getInstance();
    if (instance.initialized) {
      return;
    }

    await this.updateStyles();
    instance.initialized = true;
  }

  /**
   * Updates styles from the API or falls back to defaults
   * The workspace code (from ?workspace=<code> on the plugin script URL) scopes the
   * request to a workspace-specific style; without it, the institution default is used.
   */
  public static async updateStyles(): Promise<void> {
    if (!apiService.isInitialized()) {
      // eslint-disable-next-line no-console
      console.error('ThemeService: BBBApiService not initialized');
      return;
    }

    const instance = ThemeService.getInstance();
    try {
      const apiStyles = await apiService.fetchInstitutionStyles();
      const defaults = apiService.getDefaultStyles();
      instance.styles = {
        ...instance.styles,
        ...apiStyles,
        company: {
          ...defaults.company,
          ...instance.styles.company,
          ...apiStyles.company,
        },
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('ThemeService: Failed to update styles:', error);
    }
  }

  /**
   * Checks if a specific module is enabled
   */
  public static isModuleEnabled(moduleName: ModuleName): boolean {
    const instance = ThemeService.getInstance();
    return instance.styles[moduleName]?.isEnabled ?? false;
  }

  /**
   * Gets company branding colors
   */
  public static getCompanyColors(): CompanyColors {
    return ThemeService.getInstance().styles.company;
  }

  /**
   * Gets question module configuration if enabled
   */
  public static getQuestionColors(): QuestionThemeColors | null {
    if (!this.isModuleEnabled('questions')) {
      return null;
    }
    return ThemeService.getInstance().styles.questions;
  }

  /**
   * Gets mention module configuration if enabled
   */
  public static getMentionColors(): ThemeColors | null {
    if (!this.isModuleEnabled('mentions')) {
      return null;
    }
    return ThemeService.getInstance().styles.mentions;
  }

  /**
   * Gets moderator module configuration if enabled
   */
  public static getModeratorColors(): ModeratorThemeColors | null {
    if (!this.isModuleEnabled('moderator')) {
      return null;
    }
    return ThemeService.getInstance().styles.moderator;
  }

  public static getAllStyles(): Styles {
    return ThemeService.getInstance().styles;
  }

  public static isInitialized(): boolean {
    return ThemeService.getInstance().initialized;
  }
}
