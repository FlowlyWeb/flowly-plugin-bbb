/**
 * FlowlyServerService — WebSocket client for flowly-plugin-server.
 *
 * Provides request/response messaging via {@link sendEvent} and
 * server-initiated push handling via {@link onPush}.
 *
 * The underlying protocol uses a two-step handshake:
 *   1. `connection_init` with sessionToken
 *   2. `connection_ack` from server
 *
 * After authentication every outbound message is an `event` frame with a
 * unique `id`.  The server replies with a `response` or `error` frame
 * carrying the same `id`.  Server-initiated messages arrive as `push`
 * frames and are dispatched to registered listeners.
 */

/** WebSocket URL derived from the current page origin. */
const FLOWLY_SERVER_URL = `${
  window.location.protocol === 'https:' ? 'wss' : 'ws'
}://${window.location.host}/flowly-plugin-server`;

/** Timeout for individual sendEvent calls (ms). */
const SEND_TIMEOUT_MS = 10_000;

/** Timeout for the initial WebSocket connection handshake (ms). */
const CONNECT_TIMEOUT_MS = 5_000;

/** Interval between keepalive pings to the plugin server (ms). */
const PING_INTERVAL_MS = 30_000;

/** Shape of a server response payload. */
interface ResponseData {
  [key: string]: unknown;
}

/** Shape of a server error frame. */
interface ServerError {
  code: string;
  message: string;
}

/** Internal pending-request entry. */
interface PendingRequest {
  resolve: (data: ResponseData) => void;
  reject: (err: Error & { code?: string }) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Push listener callback. */
type PushCallback = (data: ResponseData) => void;

/**
 * Singleton WebSocket service for communicating with flowly-plugin-server.
 *
 * Usage:
 * ```ts
 * const ok = await FlowlyServerService.connect();
 * if (!ok) return; // server unavailable — skip dependent features
 * const res = await FlowlyServerService.sendEvent('user:rename', { userId, newName });
 * const unsub = FlowlyServerService.onPush('user:renamed', (data) => { ... });
 * ```
 */
export class FlowlyServerService {
  /** Active WebSocket instance. */
  private static ws: WebSocket | null = null;

  /** Whether the handshake has completed. */
  private static authenticated = false;

  /** Whether the plugin server is reachable and authenticated. */
  private static _available = false;

  /** Auto-incrementing message ID counter. */
  private static nextId = 1;

  /** Map of pending request IDs to their Promise handlers. */
  private static pending: Map<string, PendingRequest> = new Map();

  /** Map of push event names to registered listener sets. */
  private static pushListeners: Map<string, Set<PushCallback>> = new Map();

  /** Resolve callback for the in-flight connect() promise. */
  private static connectResolve: ((result: boolean) => void) | null = null;

  /** Timeout handle for the connection handshake. */
  private static connectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Interval handle for the keepalive ping. */
  private static pingTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Indicates whether the plugin server is reachable and authenticated.
   *
   * Returns `true` only after a successful `connection_ack` handshake.
   */
  static get available(): boolean {
    return this._available;
  }

  /* ─── Session token ──────────────────────────────────────────── */

  /**
   * Reads the BBB session token from the URL query string.
   *
   * @returns The session token or `null` if absent.
   */
  static getSessionToken(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('sessionToken');
  }

  /* ─── Connection lifecycle ───────────────────────────────────── */

  /**
   * Opens a WebSocket connection and performs the two-step handshake.
   *
   * Resolves `true` on successful `connection_ack`, `false` on error,
   * close, or timeout. Safe to call multiple times — subsequent calls
   * resolve `true` immediately while a connection is already open.
   */
  static connect(): Promise<boolean> {
    if (this.ws && this._available) return Promise.resolve(true);

    const sessionToken = this.getSessionToken();
    if (!sessionToken) {
      // eslint-disable-next-line no-console
      console.warn('[FlowlyServer] No sessionToken in URL — skipping connection');
      return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      this.connectResolve = resolve;

      this.connectTimer = setTimeout(() => {
        // eslint-disable-next-line no-console
        console.warn(
          '[FlowlyServer] Plugin server unreachable — server-dependent features disabled',
        );
        this.resolveConnect(false);
        this.ws?.close();
        this.cleanup();
      }, CONNECT_TIMEOUT_MS);

      // eslint-disable-next-line no-console
      console.log('[FlowlyServer] Connecting to', FLOWLY_SERVER_URL);
      const ws = new WebSocket(FLOWLY_SERVER_URL);
      this.ws = ws;

      ws.onopen = () => {
        if (this.ws !== ws) return;
        // eslint-disable-next-line no-console
        console.log('[FlowlyServer] Connected — sending connection_init');
        ws.send(JSON.stringify({ type: 'connection_init', payload: { sessionToken } }));
      };

      ws.onmessage = (event: MessageEvent) => {
        if (this.ws !== ws) return;
        this.handleMessage(event);
      };

      ws.onerror = () => {
        if (this.ws !== ws) return;
        // eslint-disable-next-line no-console
        console.warn(
          '[FlowlyServer] Plugin server unreachable — server-dependent features disabled',
        );
        this.resolveConnect(false);
      };

      ws.onclose = (event: CloseEvent) => {
        if (this.ws !== ws) return;
        // eslint-disable-next-line no-console
        console.warn('[FlowlyServer] Closed — code:', event.code, 'reason:', event.reason);
        this.resolveConnect(false);
        this.cleanup();
      };
    });
  }

  /**
   * Gracefully closes the connection and clears all internal state.
   */
  static disconnect(): void {
    this.ws?.close();
    this.cleanup();
  }

  /* ─── Request / response ─────────────────────────────────────── */

  /**
   * Sends an event to the plugin server and waits for its response.
   *
   * @param event   - Event name (e.g. `"user:rename"`).
   * @param payload - JSON-serializable payload.
   * @returns Resolved with the server response data.
   * @throws If the server replies with an error or the request times out.
   */
  static sendEvent(event: string, payload: Record<string, unknown> = {}): Promise<ResponseData> {
    return new Promise<ResponseData>((resolve, reject) => {
      if (!this.ws || !this.authenticated) {
        reject(new Error('FlowlyServer is not connected'));
        return;
      }

      const id = String(this.nextId++);

      const timer = setTimeout(() => {
        this.pending.delete(id);
        const err: Error & { code?: string } = new Error(
          `FlowlyServer request "${event}" timed out after ${SEND_TIMEOUT_MS}ms`,
        );
        err.code = 'TIMEOUT';
        reject(err);
      }, SEND_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timer });

      this.ws.send(JSON.stringify({ type: 'event', id, event, payload }));
    });
  }

  /* ─── Push listeners ─────────────────────────────────────────── */

  /**
   * Registers a listener for server-initiated push messages.
   *
   * @param event    - Push event name to listen for (e.g. `"user:renamed"`).
   * @param callback - Callback invoked with the push data.
   * @returns An unsubscribe function.
   */
  static onPush(event: string, callback: PushCallback): () => void {
    let listeners = this.pushListeners.get(event);
    if (!listeners) {
      listeners = new Set();
      this.pushListeners.set(event, listeners);
    }
    listeners.add(callback);

    return () => {
      listeners!.delete(callback);
      if (listeners!.size === 0) {
        this.pushListeners.delete(event);
      }
    };
  }

  /* ─── Internal ───────────────────────────────────────────────── */

  /**
   * Dispatches an incoming WebSocket message to the appropriate handler.
   */
  private static handleMessage(event: MessageEvent): void {
    let msg: {
      type: string;
      id?: string;
      event?: string;
      data?: ResponseData;
      error?: ServerError;
      user?: unknown;
      meeting?: unknown;
    };
    try {
      msg = JSON.parse(event.data as string);
    } catch {
      // eslint-disable-next-line no-console
      console.warn('[FlowlyServer] Received non-JSON message');
      return;
    }

    switch (msg.type) {
      case 'connection_ack':
        this.authenticated = true;
        this._available = true;
        this.startPing();
        // eslint-disable-next-line no-console
        console.log('[FlowlyServer] Authenticated');
        this.resolveConnect(true);
        break;

      case 'response':
        this.resolveRequest(msg.id, msg.data);
        break;

      case 'error':
        this.rejectRequest(msg.id, msg.error);
        break;

      case 'push':
        this.dispatchPush(msg.event, msg.data);
        break;

      case 'pong':
        /* keepalive — nothing to do */
        break;

      default:
        // eslint-disable-next-line no-console
        console.warn('[FlowlyServer] Unknown message type:', msg.type);
    }
  }

  /**
   * Resolves a pending request promise.
   */
  private static resolveRequest(id: string | undefined, data: ResponseData | undefined): void {
    if (!id) return;
    const entry = this.pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(id);
    entry.resolve(data || {});
  }

  /**
   * Rejects a pending request promise with the server error.
   */
  private static rejectRequest(id: string | undefined, serverError: ServerError | undefined): void {
    if (!id) return;
    const entry = this.pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(id);
    const err: Error & { code?: string } = new Error(
      serverError?.message || 'Unknown server error',
    );
    err.code = serverError?.code || 'UNKNOWN';
    entry.reject(err);
  }

  /**
   * Dispatches a push message to all registered listeners for that event.
   */
  private static dispatchPush(event: string | undefined, data: ResponseData | undefined): void {
    if (!event) return;
    const listeners = this.pushListeners.get(event);
    if (!listeners) return;
    for (const cb of listeners) {
      try {
        cb(data || {});
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[FlowlyServer] Push listener error for "${event}":`, err);
      }
    }
  }

  /**
   * Settles the in-flight connect() promise, if any.
   */
  private static resolveConnect(result: boolean): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    if (this.connectResolve) {
      this.connectResolve(result);
      this.connectResolve = null;
    }
  }

  /**
   * Starts the keepalive ping interval after authentication.
   */
  private static startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, PING_INTERVAL_MS);
  }

  /**
   * Stops the keepalive ping interval.
   */
  private static stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Resets all internal state after disconnect or close.
   */
  private static cleanup(): void {
    this.ws = null;
    this.authenticated = false;
    this._available = false;
    this.stopPing();
    this.resolveConnect(false);

    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error('FlowlyServer connection closed'));
    }
    this.pending.clear();
  }
}
