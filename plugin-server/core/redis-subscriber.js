'use strict';

const { send } = require('./ws-server');
const { authenticate } = require('./auth');

/**
 * Redis channel where bbb-apps-akka publishes outgoing events.
 * @type {string}
 */
const FROM_AKKA_CHANNEL = 'from-akka-apps-redis-channel';

/**
 * Interval (ms) between periodic re-auth checks for role drift.
 * Acts as a fallback when Redis events are missed.
 * @type {number}
 */
const REAUTH_INTERVAL_MS = 60_000;

/**
 * Initializes the Redis subscriber that listens for BBB Akka events
 * and updates WebSocket connection state accordingly.
 *
 * Currently handles:
 * - `UserRoleChangedEvtMsg` — updates `ws._user.isModerator` / `isPresenter`
 *   and broadcasts `user:role-changed` to all clients in the meeting.
 *
 * Also starts a periodic re-auth fallback that re-validates each connection's
 * role via the BBB auth endpoint every {@link REAUTH_INTERVAL_MS}.
 *
 * @param {import('ioredis').Redis} redisClient - An ioredis client instance (subscriber-mode).
 * @param {Map<string, Map<string, Set<WebSocket>>>} connections - Global connection map.
 * @param {Function} logger - Logging function `(level, mod, message)`.
 * @returns {{ stop: () => void }} Handle to stop the subscriber and timers.
 */
function initRoleSubscriber(redisClient, connections, logger) {
  const log = logger || (() => {});

  /* ------------------------------------------------------------------ *
   * Redis subscription
   * ------------------------------------------------------------------ */

  redisClient.subscribe(FROM_AKKA_CHANNEL, (err) => {
    if (err) {
      log(
        'ERROR',
        'role-subscriber',
        `Failed to subscribe to ${FROM_AKKA_CHANNEL}: ${err.message}`,
      );
      return;
    }
    log('INFO', 'role-subscriber', `Subscribed to ${FROM_AKKA_CHANNEL}`);
  });

  redisClient.on('message', (channel, rawMessage) => {
    if (channel !== FROM_AKKA_CHANNEL) return;

    let parsed;
    try {
      parsed = JSON.parse(rawMessage);
    } catch {
      return; // Ignore malformed JSON
    }

    const eventName = parsed?.envelope?.name;
    if (!eventName) return;

    if (eventName === 'UserRoleChangedEvtMsg') {
      handleRoleChanged(parsed, connections, log);
    }
  });

  /* ------------------------------------------------------------------ *
   * Periodic re-auth fallback
   * ------------------------------------------------------------------ */

  const reauthTimer = setInterval(() => {
    revalidateRoles(connections, log);
  }, REAUTH_INTERVAL_MS);

  /* ------------------------------------------------------------------ *
   * Cleanup handle
   * ------------------------------------------------------------------ */

  return {
    /**
     * Unsubscribes from Redis and clears the re-auth timer.
     */
    stop() {
      clearInterval(reauthTimer);
      redisClient.unsubscribe(FROM_AKKA_CHANNEL).catch(() => {});
      log('INFO', 'role-subscriber', 'Stopped');
    },
  };
}

/* ====================================================================
 * Event handlers
 * ==================================================================== */

/**
 * Processes a `UserRoleChangedEvtMsg` from Akka.
 *
 * Expected format:
 * ```json
 * {
 *   "envelope": { "name": "UserRoleChangedEvtMsg", "routing": { "meetingId": "..." } },
 *   "core": {
 *     "header": { "name": "UserRoleChangedEvtMsg", "meetingId": "..." },
 *     "body": { "userId": "w_xxx", "role": "MODERATOR", "changedBy": "w_yyy" }
 *   }
 * }
 * ```
 *
 * @param {object} parsed      - Parsed Akka message.
 * @param {Map}    connections  - Global connection map.
 * @param {Function} log       - Logger.
 */
function handleRoleChanged(parsed, connections, log) {
  const meetingId = parsed.core?.header?.meetingId || parsed.envelope?.routing?.meetingId;
  const body = parsed.core?.body;

  if (!meetingId || !body?.userId || !body?.role) {
    log('WARN', 'role-subscriber', 'Malformed UserRoleChangedEvtMsg — skipping');
    return;
  }

  const { userId, role, changedBy } = body;
  const isModerator = role === 'MODERATOR';

  log(
    'INFO',
    'role-subscriber',
    `Role changed for user=${userId} to ${role} in meeting=${meetingId} by=${changedBy || 'unknown'}`,
  );

  const meetingMap = connections.get(meetingId);
  if (!meetingMap) return;

  /* Update the cached user on each socket for the target user */
  const userSockets = meetingMap.get(userId);
  if (userSockets) {
    for (const ws of userSockets) {
      if (ws._user) {
        ws._user.isModerator = isModerator;
      }
    }
  }

  /* Broadcast user:role-changed to every client in the meeting */
  const pushMessage = {
    type: 'push',
    event: 'user:role-changed',
    data: { userId, role, isModerator, changedBy: changedBy || null },
  };

  for (const [, sockets] of meetingMap) {
    for (const ws of sockets) {
      send(ws, pushMessage);
    }
  }
}

/* ====================================================================
 * Re-auth fallback
 * ==================================================================== */

/**
 * Re-validates every active connection's role via the BBB auth endpoint.
 * If the role has changed since the initial authentication, updates `ws._user`
 * and broadcasts `user:role-changed`.
 *
 * @param {Map}    connections - Global connection map.
 * @param {Function} log      - Logger.
 */
async function revalidateRoles(connections, log) {
  for (const [meetingId, meetingMap] of connections) {
    for (const [userId, sockets] of meetingMap) {
      for (const ws of sockets) {
        if (!ws._user || !ws._sessionToken) continue;

        try {
          const { user } = await authenticate(ws._sessionToken, ws._cookies);

          if (user.isModerator !== ws._user.isModerator) {
            const oldRole = ws._user.isModerator ? 'MODERATOR' : 'VIEWER';
            const newRole = user.isModerator ? 'MODERATOR' : 'VIEWER';

            log(
              'INFO',
              'role-subscriber',
              `Re-auth detected role change for user=${userId}: ${oldRole} → ${newRole}`,
            );

            ws._user.isModerator = user.isModerator;
            ws._user.isPresenter = user.isPresenter;

            /* Broadcast to all clients in the meeting */
            const pushMessage = {
              type: 'push',
              event: 'user:role-changed',
              data: {
                userId,
                role: newRole,
                isModerator: user.isModerator,
                changedBy: null,
              },
            };

            for (const [, meetingSockets] of connections.get(meetingId) || []) {
              for (const sock of meetingSockets) {
                send(sock, pushMessage);
              }
            }
          }

          if (user.isPresenter !== ws._user.isPresenter) {
            ws._user.isPresenter = user.isPresenter;
          }
        } catch {
          /* Auth endpoint temporarily unavailable — skip this cycle */
        }
      }
    }
  }
}

module.exports = { initRoleSubscriber, FROM_AKKA_CHANNEL };
