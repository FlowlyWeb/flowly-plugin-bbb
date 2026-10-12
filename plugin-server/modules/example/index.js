'use strict';

/**
 * Example module — demonstrates the module contract.
 *
 * Events:
 * - `example:hello` — returns a greeting with the user's name.
 */
module.exports = {
  events: {
    hello: require('./on-hello'),
  },
};
