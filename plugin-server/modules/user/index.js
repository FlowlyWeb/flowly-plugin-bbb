'use strict';

/**
 * User module — actions on meeting participants.
 *
 * Events:
 * - `user:rename` — rename yourself, or a participant of your meeting (moderator).
 */
module.exports = {
  events: {
    rename: require('./on-rename'),
  },
};
