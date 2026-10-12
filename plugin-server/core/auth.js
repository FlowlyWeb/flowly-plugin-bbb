'use strict';

const http = require('http');

/**
 * Default BBB-web endpoint used for session token validation.
 * @type {string}
 */
const DEFAULT_BBB_AUTH_URL =
  'http://127.0.0.1:8090/bigbluebutton/connection/checkGraphqlAuthorization';

/**
 * Returns the current BBB auth URL, reading `BBB_AUTH_URL` from the
 * environment at call time so it can be overridden in tests.
 * @returns {string}
 */
function getBBBAuthURL() {
  return process.env.BBB_AUTH_URL || DEFAULT_BBB_AUTH_URL;
}

/**
 * Validates a BBB session token by calling the bbb-web authorization endpoint.
 *
 * On success, returns the authenticated user and meeting information extracted
 * from the response headers.
 *
 * bbb-web validates the token against the HTTP session identified by the
 * browser's cookies (JSESSIONID). When the client connects through nginx on
 * the BBB domain, those cookies are forwarded here automatically and must be
 * passed through to bbb-web.
 *
 * @param {string} sessionToken - The BBB session token to validate.
 * @param {string} [cookies]    - Raw Cookie header from the client's WebSocket upgrade request.
 * @returns {Promise<{ user: object, meeting: object }>} Resolved user and meeting data.
 * @throws {Error} If the token is invalid, expired, or the endpoint is unreachable.
 */
function authenticate(sessionToken, cookies) {
  return new Promise((resolve, reject) => {
    const url = new URL(getBBBAuthURL());

    const reqHeaders = { 'x-session-token': sessionToken };
    if (cookies) reqHeaders['Cookie'] = cookies;

    const req = http.get(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        headers: reqHeaders,
        timeout: 4000,
      },
      (res) => {
        /* Drain the response body to free up the socket */
        res.resume();

        if (res.statusCode !== 200) {
          reject(new Error(`Authentication failed (HTTP ${res.statusCode})`));
          return;
        }

        const headers = res.headers;

        const userId = headers['meeting-user-id'] || headers['user-id'];
        const meetingId = headers['meeting-id'];

        if (!userId || !meetingId) {
          reject(new Error('Authentication response missing required headers'));
          return;
        }

        resolve({
          user: {
            id: userId,
            externalId: headers['user-external-id'] || '',
            name: headers['user-name'] || '',
            isModerator: headers['user-is-moderator'] === 'true',
            isPresenter: headers['user-is-presenter'] === 'true',
          },
          meeting: {
            id: meetingId,
            externalId: headers['meeting-external-id'] || '',
          },
        });
      },
    );

    req.on('error', (err) => {
      reject(new Error(`Authentication request failed: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Authentication request timed out'));
    });
  });
}

module.exports = { authenticate };
