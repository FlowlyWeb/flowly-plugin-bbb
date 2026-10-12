import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeService } from './ThemeService';
import { apiService } from './apiService';
import type { StylesResponse } from '../types/api';

// Mock the apiService module
vi.mock('./apiService', () => {
  const defaultStyles: StylesResponse = {
    id: 'default',
    name: 'Default Theme',
    company: {
      primaryColor: '#0F70D7',
      background: { type: 'solid', color: '#06172A' },
      logo: null,
    },
    questions: {
      mainColor: '#FF9800',
      backgroundColor: '#FFF3E0',
      badge: { iconName: 'question', color: '#FF9800' },
      keyword: 'defaultQuestionKeyword',
      isEnabled: true,
    },
    mentions: {
      mainColor: '#2196F3',
      backgroundColor: '#E3F2FD',
      isEnabled: true,
    },
    moderator: {
      mainColor: '#F44336',
      backgroundColor: '#F443361A',
      badge: { iconName: 'shield', color: '#F44336' },
      isEnabled: true,
    },
    gif: { isEnabled: true },
    usernames: { isEnabled: true },
  };

  return {
    apiService: {
      getDefaultStyles: vi.fn(() => ({ ...defaultStyles })),
      isInitialized: vi.fn(() => true),
      fetchInstitutionStyles: vi.fn(() => Promise.resolve({ ...defaultStyles })),
    },
  };
});

/**
 * Reset the ThemeService singleton between tests.
 * The singleton is stored as a private static field, so we use
 * Object.assign to wipe instance-level state via a new construction cycle.
 */
function resetThemeServiceSingleton(): void {
  // Access and clear the private static instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ThemeService as any).instance = undefined;
}

describe('ThemeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetThemeServiceSingleton();
  });

  // ── Singleton ────────────────────────────────────────────────────

  describe('getInstance', () => {
    it('should return the same instance on repeated calls', () => {
      const a = ThemeService.getInstance();
      const b = ThemeService.getInstance();
      expect(a).toBe(b);
    });
  });

  // ── initialize ───────────────────────────────────────────────────

  describe('initialize', () => {
    it('should fetch styles and mark service as initialized', async () => {
      expect(ThemeService.isInitialized()).toBe(false);

      await ThemeService.initialize();

      expect(apiService.fetchInstitutionStyles).toHaveBeenCalledOnce();
      expect(ThemeService.isInitialized()).toBe(true);
    });

    it('should be idempotent — second call is a no-op', async () => {
      await ThemeService.initialize();
      await ThemeService.initialize();

      expect(apiService.fetchInstitutionStyles).toHaveBeenCalledTimes(1);
    });
  });

  // ── updateStyles ─────────────────────────────────────────────────

  describe('updateStyles', () => {
    it('should skip update when apiService is not initialized', async () => {
      vi.mocked(apiService.isInitialized).mockReturnValueOnce(false);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await ThemeService.updateStyles();

      expect(apiService.fetchInstitutionStyles).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('ThemeService: BBBApiService not initialized');
      consoleSpy.mockRestore();
    });

    it('should deep-merge fetched styles with defaults', async () => {
      const customStyles: StylesResponse = {
        id: 'custom',
        name: 'Custom Theme',
        company: {
          primaryColor: '#FF0000',
          background: { type: 'solid', color: '#000000' },
          logo: 'https://example.com/logo.png',
        },
        questions: {
          mainColor: '#00FF00',
          backgroundColor: '#E8F5E9',
          badge: { iconName: 'help', color: '#00FF00' },
          keyword: 'customKeyword',
          isEnabled: false,
        },
        mentions: {
          mainColor: '#9C27B0',
          backgroundColor: '#F3E5F5',
          isEnabled: false,
        },
        moderator: {
          mainColor: '#FF5722',
          backgroundColor: '#FBE9E7',
          badge: { iconName: 'mod', color: '#FF5722' },
          isEnabled: true,
        },
        gif: { isEnabled: false },
        usernames: { isEnabled: false },
      };

      vi.mocked(apiService.fetchInstitutionStyles).mockResolvedValueOnce(customStyles);

      await ThemeService.updateStyles();

      const styles = ThemeService.getAllStyles();
      expect(styles.company.primaryColor).toBe('#FF0000');
      expect(styles.questions.isEnabled).toBe(false);
      expect(styles.mentions.isEnabled).toBe(false);
    });

    it('should keep previous styles when fetch throws', async () => {
      vi.mocked(apiService.fetchInstitutionStyles).mockRejectedValueOnce(
        new Error('Network error'),
      );
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Initialize first so we have known state
      await ThemeService.updateStyles();

      // Styles should still be defaults (unchanged by failed fetch)
      const styles = ThemeService.getAllStyles();
      expect(styles.id).toBeDefined();
      consoleSpy.mockRestore();
    });
  });

  // ── isModuleEnabled ──────────────────────────────────────────────

  describe('isModuleEnabled', () => {
    it('should return true for enabled modules', async () => {
      await ThemeService.initialize();

      expect(ThemeService.isModuleEnabled('questions')).toBe(true);
      expect(ThemeService.isModuleEnabled('mentions')).toBe(true);
      expect(ThemeService.isModuleEnabled('moderator')).toBe(true);
      expect(ThemeService.isModuleEnabled('gif')).toBe(true);
      expect(ThemeService.isModuleEnabled('usernames')).toBe(true);
    });

    it('should return false for disabled modules', async () => {
      const disabledStyles: StylesResponse = {
        id: 'disabled',
        name: 'Disabled Theme',
        company: {
          primaryColor: '#000',
          background: { type: 'solid', color: '#000' },
          logo: null,
        },
        questions: {
          mainColor: '#000',
          backgroundColor: '#000',
          badge: null,
          keyword: null,
          isEnabled: false,
        },
        mentions: { mainColor: '#000', backgroundColor: '#000', isEnabled: false },
        moderator: {
          mainColor: '#000',
          backgroundColor: '#000',
          badge: null,
          isEnabled: false,
        },
        gif: { isEnabled: false },
        usernames: { isEnabled: false },
      };

      vi.mocked(apiService.fetchInstitutionStyles).mockResolvedValueOnce(disabledStyles);

      await ThemeService.initialize();

      expect(ThemeService.isModuleEnabled('questions')).toBe(false);
      expect(ThemeService.isModuleEnabled('mentions')).toBe(false);
      expect(ThemeService.isModuleEnabled('moderator')).toBe(false);
      expect(ThemeService.isModuleEnabled('gif')).toBe(false);
      expect(ThemeService.isModuleEnabled('usernames')).toBe(false);
    });
  });

  // ── Color getters ────────────────────────────────────────────────

  describe('getCompanyColors', () => {
    it('should return company colors from the current styles', async () => {
      await ThemeService.initialize();

      const colors = ThemeService.getCompanyColors();
      expect(colors.primaryColor).toBe('#0F70D7');
      expect(colors.background.type).toBe('solid');
    });
  });

  describe('getQuestionColors', () => {
    it('should return question colors when module is enabled', async () => {
      await ThemeService.initialize();

      const colors = ThemeService.getQuestionColors();
      expect(colors).not.toBeNull();
      expect(colors!.mainColor).toBe('#FF9800');
      expect(colors!.keyword).toBe('defaultQuestionKeyword');
    });

    it('should return null when questions module is disabled', async () => {
      const stylesWithDisabledQuestions: StylesResponse = {
        ...apiService.getDefaultStyles(),
        questions: {
          mainColor: '#FF9800',
          backgroundColor: '#FFF3E0',
          badge: null,
          keyword: null,
          isEnabled: false,
        },
      };
      vi.mocked(apiService.fetchInstitutionStyles).mockResolvedValueOnce(
        stylesWithDisabledQuestions,
      );

      await ThemeService.initialize();

      expect(ThemeService.getQuestionColors()).toBeNull();
    });
  });

  describe('getMentionColors', () => {
    it('should return mention colors when module is enabled', async () => {
      await ThemeService.initialize();

      const colors = ThemeService.getMentionColors();
      expect(colors).not.toBeNull();
      expect(colors!.mainColor).toBe('#2196F3');
    });

    it('should return null when mentions module is disabled', async () => {
      const stylesWithDisabledMentions: StylesResponse = {
        ...apiService.getDefaultStyles(),
        mentions: {
          mainColor: '#2196F3',
          backgroundColor: '#E3F2FD',
          isEnabled: false,
        },
      };
      vi.mocked(apiService.fetchInstitutionStyles).mockResolvedValueOnce(
        stylesWithDisabledMentions,
      );

      await ThemeService.initialize();

      expect(ThemeService.getMentionColors()).toBeNull();
    });
  });

  describe('getModeratorColors', () => {
    it('should return moderator colors when module is enabled', async () => {
      await ThemeService.initialize();

      const colors = ThemeService.getModeratorColors();
      expect(colors).not.toBeNull();
      expect(colors!.mainColor).toBe('#F44336');
      expect(colors!.badge?.iconName).toBe('shield');
    });

    it('should return null when moderator module is disabled', async () => {
      const stylesWithDisabledModerator: StylesResponse = {
        ...apiService.getDefaultStyles(),
        moderator: {
          mainColor: '#F44336',
          backgroundColor: '#F443361A',
          badge: null,
          isEnabled: false,
        },
      };
      vi.mocked(apiService.fetchInstitutionStyles).mockResolvedValueOnce(
        stylesWithDisabledModerator,
      );

      await ThemeService.initialize();

      expect(ThemeService.getModeratorColors()).toBeNull();
    });
  });

  // ── getAllStyles ──────────────────────────────────────────────────

  describe('getAllStyles', () => {
    it('should return the full styles object', async () => {
      await ThemeService.initialize();

      const styles = ThemeService.getAllStyles();
      expect(styles).toHaveProperty('id');
      expect(styles).toHaveProperty('company');
      expect(styles).toHaveProperty('questions');
      expect(styles).toHaveProperty('mentions');
      expect(styles).toHaveProperty('moderator');
      expect(styles).toHaveProperty('gif');
      expect(styles).toHaveProperty('usernames');
    });
  });
});
