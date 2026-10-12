'use strict';

/**
 * Handler for the "example:hello" event.
 *
 * Returns a greeting message using the authenticated user's name.
 *
 * @param {object} ctx     - Connection context.
 * @param {object} payload - Client payload.
 * @param {string} [payload.message] - Optional message from the client.
 * @returns {Promise<{ greeting: string }>}
 */
module.exports = async (ctx, payload) => {
  const name = ctx.user.name || 'stranger';
  const clientMsg = payload && payload.message ? ` You said: "${payload.message}"` : '';

  return { greeting: `Hello ${name}!${clientMsg}` };
};
