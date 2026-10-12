import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiService } from './apiService';

// Mock the config module to avoid Webpack DefinePlugin dependencies
vi.mock('../config/constants', () => ({
  config: {
    baseUrl: 'http://localhost:3000/api',
    giphyApiKey: '',
  },
}));

// Provide a minimal SubtleCrypto for the `verifyIntegrity` path
const mockSubtle = {
  digest: vi.fn(async (_algo: string, _data: ArrayBuffer) => {
    // Return a deterministic fake hash
    return new Uint8Array(32).buffer;
  }),
};

// Ensure crypto.subtle is available in jsdom
Object.defineProperty(globalThis, 'crypto', {
  value: {
    ...globalThis.crypto,
    subtle: mockSubtle,
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  },
  writable: true,
});

describe('apiService', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset apiService static state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiService as any).pluginApi = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiService as any).encryptionKey = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiService as any).currentStyles = { ...apiService.getDefaultStyles() };

    // Mock fetch
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;

    // Mock localStorage
    localStorageMock = {};
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
        setItem: vi.fn((key: string, val: string) => {
          localStorageMock[key] = val;
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageMock[key];
        }),
        clear: vi.fn(() => {
          localStorageMock = {};
        }),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── initialize / isInitialized ───────────────────────────────────

  describe('initialize / isInitialized', () => {
    it('should report not initialized before initialize()', () => {
      expect(apiService.isInitialized()).toBe(false);
    });

    it('should report initialized after initialize()', () => {
      apiService.initialize({} as unknown);

      expect(apiService.isInitialized()).toBe(true);
    });
  });

  // ── getDefaultStyles ─────────────────────────────────────────────

  describe('getDefaultStyles', () => {
    it('should return a complete default styles object', () => {
      const styles = apiService.getDefaultStyles();

      expect(styles.id).toBe('default');
      expect(styles.name).toBe('Default Theme');
      expect(styles.company.primaryColor).toBe('#0F70D7');
      expect(styles.questions.isEnabled).toBe(true);
      expect(styles.mentions.isEnabled).toBe(true);
      expect(styles.moderator.isEnabled).toBe(true);
      expect(styles.gif.isEnabled).toBe(true);
      expect(styles.usernames.isEnabled).toBe(true);
    });
  });

  // ── encryptData / decryptData (obfuscation) ──────────────────────

  describe('encryptData / decryptData', () => {
    it('should round-trip data through encrypt then decrypt', async () => {
      const original = 'my-secret-api-key';

      // Access private methods via bracket notation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const encrypted = await (apiService as any).encryptData(original);

      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(original);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const decrypted = await (apiService as any).decryptData(encrypted);
      expect(decrypted).toBe(original);
    });

    it('should produce different ciphertext for the same input (random salt)', async () => {
      const data = 'same-data';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = await (apiService as any).encryptData(data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = await (apiService as any).encryptData(data);

      // Salt is random so encoded output should differ
      expect(a).not.toBe(b);
    });

    it('should handle corrupted data gracefully by clearing storage', async () => {
      const clearSpy = vi.spyOn(apiService, 'clearStoredData');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (apiService as any).decryptData('!!!invalid-base64!!!');

      expect(clearSpy).toHaveBeenCalled();
      expect(result).toBe('');
    });
  });

  // ── fetchInstitutionStyles ───────────────────────────────────────

  describe('fetchInstitutionStyles', () => {
    beforeEach(() => {
      // Mock document.querySelectorAll for extractWorkspaceFromManifest
      vi.spyOn(document, 'querySelectorAll').mockReturnValue([] as unknown as NodeListOf<Element>);
    });

    it('should fetch styles from the API and return them', async () => {
      const apiStyles = {
        id: 'inst-1',
        name: 'Institution Theme',
        company: {
          primaryColor: '#123456',
          background: { type: 'solid', color: '#000' },
          logo: null,
        },
        questions: {
          mainColor: '#000',
          backgroundColor: '#000',
          badge: null,
          keyword: null,
          isEnabled: true,
        },
        mentions: { mainColor: '#000', backgroundColor: '#000', isEnabled: true },
        moderator: {
          mainColor: '#000',
          backgroundColor: '#000',
          badge: null,
          isEnabled: true,
        },
        gif: { isEnabled: true },
        usernames: { isEnabled: true },
      };

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiStyles),
      });

      const result = await apiService.fetchInstitutionStyles();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/institutions/styles'),
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result.id).toBe('inst-1');
    });

    it('should return default styles on non-ok response', async () => {
      fetchSpy.mockResolvedValueOnce({ ok: false, status: 404 });

      const result = await apiService.fetchInstitutionStyles();

      expect(result.id).toBe('default');
    });

    it('should return default styles on network error', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network failure'));

      const result = await apiService.fetchInstitutionStyles();

      expect(result.id).toBe('default');
    });

    it('should append workspaceCode query param when script URL contains workspace', async () => {
      const mockScript = document.createElement('script');
      mockScript.setAttribute(
        'src',
        'https://cdn.example.com/FlowlyWebIntegration.js?workspace=MYCODE',
      );

      vi.spyOn(document, 'querySelectorAll').mockReturnValue([
        mockScript,
      ] as unknown as NodeListOf<Element>);

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(apiService.getDefaultStyles()),
      });

      await apiService.fetchInstitutionStyles();

      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain('workspaceCode=MYCODE');
    });
  });

  // ── sendHeartbeat ────────────────────────────────────────────────

  describe('sendHeartbeat', () => {
    const heartbeatData = {
      serverId: 'bbb.example.com',
      meetingId: 'meeting-123',
      userId: 'user-456',
      timestamp: 1700000000000,
    };

    it('should return false when apiService is not initialized', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await apiService.sendHeartbeat(heartbeatData);

      expect(result).toBe(false);
      expect(fetchSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should POST heartbeat data and return success flag', async () => {
      apiService.initialize({} as unknown);

      fetchSpy.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const result = await apiService.sendHeartbeat(heartbeatData);

      expect(result).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/servers/heartbeat'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(heartbeatData),
        }),
      );
    });

    it('should return false on HTTP error', async () => {
      apiService.initialize({} as unknown);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      fetchSpy.mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await apiService.sendHeartbeat(heartbeatData);

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });

    it('should return false on network failure', async () => {
      apiService.initialize({} as unknown);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      fetchSpy.mockRejectedValueOnce(new Error('offline'));

      const result = await apiService.sendHeartbeat(heartbeatData);

      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });
  });

  // ── extractDomain ────────────────────────────────────────────────

  describe('extractDomain', () => {
    it('should extract domain from a full URL', () => {
      expect(apiService.extractDomain('https://app.example.com/path')).toBe('example.com');
    });

    it('should return hostname when only two parts', () => {
      expect(apiService.extractDomain('https://example.com')).toBe('example.com');
    });

    it('should handle deep subdomains', () => {
      expect(apiService.extractDomain('https://a.b.c.example.com')).toBe('example.com');
    });

    it('should return empty string for invalid URLs', () => {
      expect(apiService.extractDomain('not-a-url')).toBe('');
    });
  });

  // ── localStorage integration ─────────────────────────────────────

  describe('storage', () => {
    it('should store and retrieve institution data via localStorage', async () => {
      const institution = { name: 'Test', domain: 'test.com', checksum: 'abc' };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (apiService as any).storeInstitutionData('api-key-123', institution);

      expect(localStorage.setItem).toHaveBeenCalledWith('flowly_data', expect.any(String));

      // Verify the stored data can be parsed
      const storedRaw = localStorageMock['flowly_data'];
      expect(storedRaw).toBeDefined();
      const parsed = JSON.parse(storedRaw);
      expect(parsed.institution).toBe(JSON.stringify(institution));
      expect(parsed.timestamp).toBeGreaterThan(0);
    });

    it('should return null for getApiKey when no data stored', async () => {
      const result = await apiService.getApiKey();
      expect(result).toBeNull();
    });

    it('should decrypt and return stored API key', async () => {
      const institution = { name: 'Test', domain: 'test.com', checksum: 'abc' };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (apiService as any).storeInstitutionData('secret-key', institution);

      const key = await apiService.getApiKey();
      expect(key).toBe('secret-key');
    });
  });

  // ── clearStoredData ──────────────────────────────────────────────

  describe('clearStoredData', () => {
    it('should remove stored data and reset styles to defaults', () => {
      apiService.clearStoredData();

      expect(localStorage.removeItem).toHaveBeenCalledWith('flowly_data');
      const styles = apiService.getStyles();
      expect(styles.id).toBe('default');
    });
  });
});
