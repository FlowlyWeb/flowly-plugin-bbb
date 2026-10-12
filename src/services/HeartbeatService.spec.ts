import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeartbeatService } from './HeartbeatService';
import { apiService } from './apiService';

// Mock apiService
vi.mock('./apiService', () => ({
  apiService: {
    sendHeartbeat: vi.fn(() => Promise.resolve(true)),
    BASE_URL: 'http://localhost:3000/api',
  },
}));

// Mock the config module (transitive dependency)
vi.mock('../config/constants', () => ({
  config: {
    baseUrl: 'http://localhost:3000/api',
    giphyApiKey: '',
  },
}));

/**
 * Reset HeartbeatService static state between tests.
 */
function resetHeartbeatService(): void {
  HeartbeatService.cleanup();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (HeartbeatService as any).pluginApi = null;
}

/**
 * Minimal PluginApi stub used to satisfy the initialize() call.
 */
const fakePluginApi = {} as Parameters<typeof HeartbeatService.initialize>[0];

describe('HeartbeatService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetHeartbeatService();

    // Provide a stable window.location for meeting ID extraction
    Object.defineProperty(window, 'location', {
      value: {
        hostname: 'bbb.test.com',
        search: '?sessionToken=abc123',
        protocol: 'https:',
        host: 'bbb.test.com',
        origin: 'https://bbb.test.com',
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── initialize ───────────────────────────────────────────────────

  describe('initialize', () => {
    it('should accept and store the pluginApi reference', () => {
      // Should not throw
      HeartbeatService.initialize(fakePluginApi);
    });
  });

  // ── updateUserInfo ───────────────────────────────────────────────

  describe('updateUserInfo', () => {
    it('should start heartbeat when user becomes moderator', () => {
      HeartbeatService.initialize(fakePluginApi);
      HeartbeatService.updateUserInfo(true, 'user-1');

      // First heartbeat fires immediately
      expect(apiService.sendHeartbeat).toHaveBeenCalledTimes(1);
      expect(apiService.sendHeartbeat).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 'bbb.test.com',
          userId: 'user-1',
        }),
      );
    });

    it('should NOT start heartbeat for non-moderator users', () => {
      HeartbeatService.initialize(fakePluginApi);
      HeartbeatService.updateUserInfo(false, 'user-2');

      expect(apiService.sendHeartbeat).not.toHaveBeenCalled();
    });

    it('should stop heartbeat when moderator status is revoked', () => {
      HeartbeatService.initialize(fakePluginApi);

      // Become moderator — starts heartbeat
      HeartbeatService.updateUserInfo(true, 'user-3');
      expect(apiService.sendHeartbeat).toHaveBeenCalledTimes(1);

      // Lose moderator status — stops heartbeat
      HeartbeatService.updateUserInfo(false, 'user-3');

      // Advance past several intervals — no additional calls
      vi.advanceTimersByTime(60 * 60 * 1000);
      expect(apiService.sendHeartbeat).toHaveBeenCalledTimes(1);
    });

    it('should not restart heartbeat if already running for moderator', () => {
      HeartbeatService.initialize(fakePluginApi);

      HeartbeatService.updateUserInfo(true, 'user-4');
      expect(apiService.sendHeartbeat).toHaveBeenCalledTimes(1);

      // Call again with same moderator status
      HeartbeatService.updateUserInfo(true, 'user-4');

      // Should not have fired another immediate heartbeat from a new interval
      expect(apiService.sendHeartbeat).toHaveBeenCalledTimes(1);
    });
  });

  // ── Periodic heartbeat ──────────────────────────────────────────

  describe('periodic heartbeat', () => {
    it('should send heartbeat at 15-minute intervals', () => {
      HeartbeatService.initialize(fakePluginApi);
      HeartbeatService.updateUserInfo(true, 'user-5');

      // Initial immediate call
      expect(apiService.sendHeartbeat).toHaveBeenCalledTimes(1);

      // Advance 15 minutes
      vi.advanceTimersByTime(15 * 60 * 1000);
      expect(apiService.sendHeartbeat).toHaveBeenCalledTimes(2);

      // Advance another 15 minutes
      vi.advanceTimersByTime(15 * 60 * 1000);
      expect(apiService.sendHeartbeat).toHaveBeenCalledTimes(3);
    });

    it('should include meetingId extracted from sessionToken', () => {
      HeartbeatService.initialize(fakePluginApi);
      HeartbeatService.updateUserInfo(true, 'user-6');

      expect(apiService.sendHeartbeat).toHaveBeenCalledWith(
        expect.objectContaining({
          meetingId: 'abc123',
        }),
      );
    });

    it('should use meetingID param when sessionToken is absent', () => {
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'bbb.test.com',
          search: '?meetingID=mtg-789',
          protocol: 'https:',
          host: 'bbb.test.com',
          origin: 'https://bbb.test.com',
        },
        writable: true,
      });

      HeartbeatService.initialize(fakePluginApi);
      HeartbeatService.updateUserInfo(true, 'user-7');

      expect(apiService.sendHeartbeat).toHaveBeenCalledWith(
        expect.objectContaining({
          meetingId: 'mtg-789',
        }),
      );
    });

    it('should fall back to hostname-based ID when no URL params', () => {
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'bbb.test.com',
          search: '',
          protocol: 'https:',
          host: 'bbb.test.com',
          origin: 'https://bbb.test.com',
        },
        writable: true,
      });

      // Mock sessionStorage to return null
      Object.defineProperty(window, 'sessionStorage', {
        value: {
          getItem: vi.fn(() => null),
          setItem: vi.fn(),
        },
        writable: true,
      });

      HeartbeatService.initialize(fakePluginApi);
      HeartbeatService.updateUserInfo(true, 'user-8888');

      expect(apiService.sendHeartbeat).toHaveBeenCalledWith(
        expect.objectContaining({
          meetingId: expect.stringContaining('meeting-bbb.test.com-user-888'),
        }),
      );
    });
  });

  // ── sendHeartbeat guards ─────────────────────────────────────────

  describe('sendHeartbeat guards', () => {
    it('should not send heartbeat when pluginApi is null', () => {
      // Do NOT call initialize — pluginApi stays null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (HeartbeatService as any).isModeratorUser = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (HeartbeatService as any).userId = 'user-9';

      // Call the private sendHeartbeat
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (HeartbeatService as any).sendHeartbeat();

      expect(apiService.sendHeartbeat).not.toHaveBeenCalled();
    });

    it('should not send heartbeat when userId is empty', () => {
      HeartbeatService.initialize(fakePluginApi);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (HeartbeatService as any).isModeratorUser = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (HeartbeatService as any).userId = '';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (HeartbeatService as any).sendHeartbeat();

      expect(apiService.sendHeartbeat).not.toHaveBeenCalled();
    });
  });

  // ── cleanup ──────────────────────────────────────────────────────

  describe('cleanup', () => {
    it('should stop the heartbeat interval and reset user state', () => {
      HeartbeatService.initialize(fakePluginApi);
      HeartbeatService.updateUserInfo(true, 'user-10');

      // 1 immediate call
      expect(apiService.sendHeartbeat).toHaveBeenCalledTimes(1);

      HeartbeatService.cleanup();

      // Advance time — no more calls after cleanup
      vi.advanceTimersByTime(60 * 60 * 1000);
      expect(apiService.sendHeartbeat).toHaveBeenCalledTimes(1);
    });

    it('should be safe to call cleanup multiple times', () => {
      HeartbeatService.cleanup();
      HeartbeatService.cleanup();
      // No errors expected
    });
  });
});
