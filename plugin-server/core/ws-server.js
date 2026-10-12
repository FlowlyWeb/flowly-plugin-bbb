'use strict';

const { WebSocketServer } = require('ws');

/**
 * Connection states used throughout the lifecycle.
 * @readonly
 * @enum {string}
 */
const ConnectionState = Object.freeze({
  CONNECTED: 'CONNECTED',
  AUTHENTICATED: 'AUTHENTICATED',
});

/**
 * Custom WebSocket close codes as defined in the protocol specification.
 * @readonly
 * @enum {number}
 */
const CloseCodes = Object.freeze({
  NORMAL: 1000,
  UNAUTHORIZED: 4401,
  TIMEOUT: 4408,
  MEETING_ENDED: 4410,
  INTERNAL_ERROR: 4500,
});

/** Delay before closing a connection that has not sent `connection_init` (ms). */
const AUTH_TIMEOUT_MS = 5_000;

/** Interval between native WebSocket pings (ms). */
const HEARTBEAT_INTERVAL_MS = 30_000;

/** Maximum silence duration before considering a connection dead (ms). */
const INACTIVITY_TIMEOUT_MS = 90_000;

/** Maximum size of an incoming message (bytes). Protocol messages are tiny. */
const MAX_PAYLOAD_BYTES = 64 * 1024;

/**
 * Creates and returns a configured WebSocket server.
 *
 * The server handles:
 * - Two-step handshake (`connection_init` / `connection_ack`).
 * - Auth timeout (5 s) and inactivity timeout (90 s).
 * - Native WebSocket ping every 30 s for dead-connection detection.
 * - Application-level ping/pong keepalive.
 * - Per-meeting / per-user connection tracking for broadcast support.
 *
 * @param {object}   options
 * @param {number}   options.port  - Port to listen on.
 * @param {string}   options.host  - Host to bind to.
 * @param {Function} options.authenticate - `async (sessionToken) => { user, meeting }` or throws.
 * @param {Function} options.dispatch     - `async (ctx, event, payload) => data` or throws.
 * @param {object}   options.coreServices - Shared services (redis, pg) passed to context factory.
 * @param {Function} options.createContext - `(ws, user, meeting, coreServices, connections) => ctx`.
 * @param {Function} [options.onListening] - Callback invoked once the server is listening.
 * @returns {{ wss: WebSocketServer, connections: Map, close: Function }}
 */
function createWSServer(options) {
  const { port, host, authenticate, dispatch, coreServices, createContext, onListening, logger } =
    options;

  /** No-op fallback so all log calls are safe even without a logger. */
  const log = logger || (() => {});

  /**
   * Connection tracking: meetingId → Map<userId, Set<WebSocket>>.
   * Used by `broadcast` and cleanup logic.
   * @type {Map<string, Map<string, Set<WebSocket>>>}
   */
  const connections = new Map();

  const wss = new WebSocketServer({ port, host, maxPayload: MAX_PAYLOAD_BYTES }, () => {
    if (onListening) onListening();
  });

  /* ------------------------------------------------------------------
   * Native WebSocket ping — detect dead TCP connections
   * ---------------------------------------------------------------- */

  const heartbeatTimer = setInterval(() => {
    for (const ws of wss.clients) {
      if (ws._isAlive === false) {
        ws.terminate();
        continue;
      }
      ws._isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('close', () => {
    clearInterval(heartbeatTimer);
  });

  /* ------------------------------------------------------------------
   * New connection handler
   * ---------------------------------------------------------------- */

  wss.on('connection', (ws, req) => {
    ws._isAlive = true;
    ws._state = ConnectionState.CONNECTED;
    ws._lastActivity = Date.now();

    const remoteIp = req.socket.remoteAddress || 'unknown';
    const cookies = req.headers.cookie || null;
    log('INFO', 'ws-server', `New connection from ${remoteIp}`);

    /* --- Auth timeout ------------------------------------------------ */
    const authTimer = setTimeout(() => {
      if (ws._state !== ConnectionState.AUTHENTICATED) {
        ws.close(CloseCodes.TIMEOUT, 'Auth timeout');
      }
    }, AUTH_TIMEOUT_MS);

    /* --- Inactivity timeout ----------------------------------------- */
    let inactivityTimer = null;

    /**
     * Resets the inactivity timer. Called on every incoming message after
     * the connection is authenticated.
     */
    function resetInactivityTimer() {
      ws._lastActivity = Date.now();
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        ws.close(CloseCodes.TIMEOUT, 'Inactivity timeout');
      }, INACTIVITY_TIMEOUT_MS);
    }

    /* --- Native pong listener --------------------------------------- */
    ws.on('pong', () => {
      ws._isAlive = true;
    });

    /* --- Message handling ------------------------------------------- */
    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return; // Ignore malformed JSON
      }

      /* Before authentication: only accept connection_init */
      if (ws._state === ConnectionState.CONNECTED) {
        if (msg.type !== 'connection_init') return;

        const sessionToken = msg.payload && msg.payload.sessionToken;
        if (!sessionToken) {
          ws.close(CloseCodes.UNAUTHORIZED, 'Unauthorized');
          clearTimeout(authTimer);
          return;
        }

        const tokenHint = sessionToken.slice(0, 6) + '…';
        log(
          'INFO',
          'ws-server',
          `Auth attempt token=${tokenHint} ip=${remoteIp} cookies=${cookies ? 'yes' : 'none'}`,
        );

        try {
          const { user, meeting } = await authenticate(sessionToken, cookies);

          ws._state = ConnectionState.AUTHENTICATED;
          ws._user = user;
          ws._meeting = meeting;
          ws._sessionToken = sessionToken;
          ws._cookies = cookies;
          clearTimeout(authTimer);

          /* Register in connection tracking */
          trackConnection(connections, meeting.id, user.id, ws);

          /* Build context */
          ws._ctx = createContext(ws, user, meeting, coreServices, connections);

          /* Send connection_ack */
          send(ws, { type: 'connection_ack', user, meeting });

          log('INFO', 'ws-server', `Authenticated user=${user.id} meeting=${meeting.id}`);

          /* Start inactivity timer */
          resetInactivityTimer();
        } catch (err) {
          log('WARN', 'ws-server', `Auth failed token=${tokenHint}: ${err.message}`);
          ws.close(CloseCodes.UNAUTHORIZED, 'Unauthorized');
          clearTimeout(authTimer);
        }
        return;
      }

      /* After authentication: handle event, ping */
      resetInactivityTimer();

      if (msg.type === 'ping') {
        send(ws, { type: 'pong' });
        return;
      }

      if (msg.type === 'event') {
        const { id, event, payload } = msg;

        if (!id || !event) {
          send(ws, {
            type: 'error',
            id: id || null,
            error: { code: 'INVALID_PAYLOAD', message: 'Missing id or event' },
          });
          return;
        }

        log('INFO', 'ws-server', `Event "${event}" user=${ws._user.id}`);

        try {
          const data = await dispatch(ws._ctx, event, payload);
          send(ws, { type: 'response', id, data });
        } catch (err) {
          log(
            'WARN',
            'ws-server',
            `Event "${event}" error: ${err.code || 'INTERNAL_ERROR'} — ${err.message}`,
          );
          send(ws, {
            type: 'error',
            id,
            error: {
              code: err.code || 'INTERNAL_ERROR',
              message: err.message || 'Internal error',
            },
          });
        }
        return;
      }

      /* Unknown message type — silently ignored */
    });

    /* --- Close / cleanup -------------------------------------------- */
    ws.on('close', (code) => {
      clearTimeout(authTimer);
      if (inactivityTimer) clearTimeout(inactivityTimer);

      if (ws._meeting && ws._user) {
        log(
          'INFO',
          'ws-server',
          `Disconnected user=${ws._user.id} meeting=${ws._meeting.id} code=${code}`,
        );
        untrackConnection(connections, ws._meeting.id, ws._user.id, ws);
      } else {
        log('INFO', 'ws-server', `Connection closed before auth ip=${remoteIp} code=${code}`);
      }
    });

    ws.on('error', () => {
      /* Errors are followed by a close event; cleanup happens there. */
    });
  });

  /* ------------------------------------------------------------------
   * Graceful shutdown helper
   * ---------------------------------------------------------------- */

  /**
   * Closes all connections and shuts down the server.
   * @returns {Promise<void>}
   */
  function close() {
    return new Promise((resolve, reject) => {
      clearInterval(heartbeatTimer);
      for (const ws of wss.clients) {
        ws.close(CloseCodes.NORMAL, 'Server shutting down');
      }
      wss.close((err) => (err ? reject(err) : resolve()));
    });
  }

  return { wss, connections, close };
}

/* ====================================================================
 * Connection tracking helpers
 * =================================================================== */

/**
 * Registers a WebSocket in the connection map.
 * @param {Map} connections - The global connection map.
 * @param {string} meetingId
 * @param {string} userId
 * @param {WebSocket} ws
 */
function trackConnection(connections, meetingId, userId, ws) {
  if (!connections.has(meetingId)) {
    connections.set(meetingId, new Map());
  }
  const meetingMap = connections.get(meetingId);
  if (!meetingMap.has(userId)) {
    meetingMap.set(userId, new Set());
  }
  meetingMap.get(userId).add(ws);
}

/**
 * Removes a WebSocket from the connection map and cleans up empty entries.
 * @param {Map} connections - The global connection map.
 * @param {string} meetingId
 * @param {string} userId
 * @param {WebSocket} ws
 */
function untrackConnection(connections, meetingId, userId, ws) {
  const meetingMap = connections.get(meetingId);
  if (!meetingMap) return;

  const userSockets = meetingMap.get(userId);
  if (!userSockets) return;

  userSockets.delete(ws);
  if (userSockets.size === 0) meetingMap.delete(userId);
  if (meetingMap.size === 0) connections.delete(meetingId);
}

/* ====================================================================
 * Utility
 * =================================================================== */

/**
 * Sends a JSON message over a WebSocket if the connection is open.
 * @param {WebSocket} ws
 * @param {object} data
 */
function send(ws, data) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

module.exports = {
  createWSServer,
  CloseCodes,
  ConnectionState,
  send,
};
