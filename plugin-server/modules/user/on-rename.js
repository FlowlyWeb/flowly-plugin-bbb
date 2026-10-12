'use strict';

/** Maximum allowed length for a display name. */
const MAX_NAME_LENGTH = 70;

/**
 * Handler for the "user:rename" event.
 *
 * Lets a participant rename themselves, or a moderator rename a participant
 * of the same meeting, by updating the user record directly in the
 * BigBlueButton PostgreSQL database via the ctx.pg pool, then broadcasting
 * the change to all connected clients.
 *
 * @param {object} ctx     - Connection context (user, meeting, pg, broadcast…).
 * @param {object} payload - Client payload.
 * @param {string} payload.userId  - Target user's internal ID (e.g. "w_xxx").
 * @param {string} payload.newName - Desired display name.
 * @returns {Promise<{ success: boolean, userId: string, newName: string }>}
 */
module.exports = async (ctx, payload) => {
  /* ── Payload validation ────────────────────────────────────────── */
  if (
    !payload ||
    typeof payload.userId !== 'string' ||
    !payload.userId.trim() ||
    typeof payload.newName !== 'string' ||
    !payload.newName.trim()
  ) {
    const err = new Error('userId and newName are required non-empty strings');
    err.code = 'INVALID_PAYLOAD';
    throw err;
  }

  const userId = payload.userId.trim();
  const displayName = payload.newName.trim().slice(0, MAX_NAME_LENGTH);

  /* ── Authorization ─────────────────────────────────────────────── */
  if (userId !== ctx.user.id && !ctx.user.isModerator) {
    const err = new Error('Only moderators can rename other participants');
    err.code = 'UNAUTHORIZED';
    throw err;
  }

  /* ── PostgreSQL UPDATE (parameterized query) ───────────────────── */
  if (!ctx.pg) {
    const err = new Error('PostgreSQL client not available');
    err.code = 'INTERNAL_ERROR';
    throw err;
  }

  /* Fetch the old name before updating. Scoped to the caller's meeting. */
  const selectResult = await ctx.pg.query(
    `SELECT name FROM "user" WHERE "userId" = $1 AND "meetingId" = $2`,
    [userId, ctx.meeting.id],
  );

  if (selectResult.rowCount === 0) {
    const err = new Error(`User "${userId}" not found`);
    err.code = 'INVALID_PAYLOAD';
    throw err;
  }

  const oldName = selectResult.rows[0].name || userId;

  /* Apply the rename. */
  await ctx.pg.query(`UPDATE "user" SET name = $1 WHERE "userId" = $2 AND "meetingId" = $3`, [
    displayName,
    userId,
    ctx.meeting.id,
  ]);

  /*
   * Notify Hasura so that BBB's GraphQL subscriptions pick up the change.
   * Hasura listens to PostgreSQL NOTIFY events to invalidate its cache
   * and push updates to connected clients (participant list, chips, etc.).
   */
  await ctx.pg.query(
    `SELECT pg_notify('hasura_event', json_build_object('table', 'user', 'op', 'UPDATE', 'userId', $1::text)::text)`,
    [userId],
  );

  /* ── Broadcast to all meeting participants ─────────────────────── */
  ctx.broadcast('user:renamed', { userId, oldName, newName: displayName });

  return { success: true, userId, newName: displayName };
};
