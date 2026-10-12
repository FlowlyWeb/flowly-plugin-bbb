'use strict';

const { send } = require('./ws-server');

/** Redis channel used by bbb-apps-akka for incoming messages. */
const AKKA_REDIS_CHANNEL = 'to-akka-apps-redis-channel';

/**
 * Creates a context object (`ctx`) for an authenticated WebSocket connection.
 *
 * The context is passed to every module handler and exposes user/meeting info,
 * service clients (Redis, PostgreSQL, WebSocket) and utility methods (push,
 * broadcast, publishToAkka).
 *
 * @param {WebSocket} ws          - The authenticated WebSocket connection.
 * @param {object}    user        - Authenticated user info.
 * @param {object}    meeting     - Meeting info.
 * @param {object}    coreServices - Shared service clients.
 * @param {object}    [coreServices.redis] - ioredis client instance.
 * @param {object}    [coreServices.pg]    - pg.Pool instance.
 * @param {Map}       connections - Global connection map (meetingId → Map<userId, Set<ws>>).
 * @returns {object} The handler context.
 */
function createContext(ws, user, meeting, coreServices, connections) {
  const ctx = {
    /** @type {object} Authenticated user info. */
    user,

    /** @type {object} Meeting info. */
    meeting,

    /** @type {WebSocket} The WebSocket connection for this user. */
    ws,

    /** @type {object|null} ioredis client (null when not configured). */
    redis: (coreServices && coreServices.redis) || null,

    /** @type {object|null} pg.Pool instance (null when not configured). */
    pg: (coreServices && coreServices.pg) || null,

    /**
     * Sends a push message to this user's connection.
     *
     * @param {string} event - Event name (e.g. "example:notification").
     * @param {object} data  - Payload to send.
     */
    push(event, data) {
      send(ws, { type: 'push', event, data });
    },

    /**
     * Broadcasts a push message to all connected users of the same meeting.
     *
     * @param {string} event            - Event name.
     * @param {object} data             - Payload to send.
     * @param {object} [filter]         - Optional filter.
     * @param {string} [filter.role]    - Role filter ("moderator" or "presenter").
     * @param {string[]} [filter.userIds] - Target specific user IDs.
     */
    broadcast(event, data, filter) {
      const meetingMap = connections.get(meeting.id);
      if (!meetingMap) return;

      const message = { type: 'push', event, data };

      for (const [userId, sockets] of meetingMap) {
        /* Apply filter if provided */
        if (filter) {
          if (filter.userIds && !filter.userIds.includes(userId)) continue;

          /* Role filter requires checking the user info attached to each socket */
          if (filter.role) {
            for (const sock of sockets) {
              if (matchesRole(sock._user, filter.role)) {
                send(sock, message);
              }
            }
            continue;
          }
        }

        for (const sock of sockets) {
          send(sock, message);
        }
      }
    },

    /**
     * Publishes a message to bbb-apps-akka via Redis pub/sub.
     *
     * Constructs the envelope + core format expected by Akka and publishes
     * it on the `to-akka-apps-redis-channel` channel.
     *
     * @param {string} eventName - The Akka event name (e.g. "MyCustomMsg").
     * @param {object} body      - The message body.
     * @returns {Promise<number>} Number of subscribers that received the message.
     * @throws {Error} If Redis is not configured.
     */
    async publishToAkka(eventName, body) {
      if (!ctx.redis) {
        const err = new Error('Redis client not available');
        err.code = 'INTERNAL_ERROR';
        throw err;
      }

      const message = JSON.stringify({
        envelope: {
          name: eventName,
          routing: {
            meetingId: meeting.id,
            userId: user.id,
          },
          timestamp: Date.now(),
        },
        core: {
          header: {
            name: eventName,
            meetingId: meeting.id,
            userId: user.id,
          },
          body: body || {},
        },
      });

      return ctx.redis.publish(AKKA_REDIS_CHANNEL, message);
    },
  };

  return ctx;
}

/**
 * Checks whether a user matches a role filter.
 *
 * @param {object} user   - The user object attached to the socket.
 * @param {string} role   - "moderator" or "presenter".
 * @returns {boolean}
 */
function matchesRole(user, role) {
  if (!user) return false;
  if (role === 'moderator') return user.isModerator === true;
  if (role === 'presenter') return user.isPresenter === true;
  return false;
}

module.exports = { createContext, AKKA_REDIS_CHANNEL };
