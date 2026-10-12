'use strict';

const fs = require('fs');
const path = require('path');

/** Default timeout for handler execution (ms). */
const HANDLER_TIMEOUT_MS = 10_000;

/**
 * Scans the `modules/` directory, loads every module that exposes an
 * `index.js` with an `events` map, and returns a `dispatch` function
 * that resolves `"module:action"` strings to the appropriate handler.
 *
 * @param {string}   modulesDir   - Absolute path to the modules directory.
 * @param {object}   coreServices - Shared services passed to `onLoad` hooks.
 * @param {Function} log          - Logging function `(level, mod, message)`.
 * @param {object}   [options]    - Optional settings.
 * @param {number}   [options.handlerTimeoutMs] - Handler timeout in ms (default 10000).
 * @returns {{ dispatch: Function, unloadAll: Function }}
 */
function loadModules(modulesDir, coreServices, log, options) {
  const handlerTimeoutMs = (options && options.handlerTimeoutMs) || HANDLER_TIMEOUT_MS;
  /**
   * Routing table: "moduleName:action" → handler function.
   * @type {Map<string, Function>}
   */
  const routes = new Map();

  /**
   * Loaded module definitions, keyed by module name.
   * Used for calling `onUnload` during shutdown.
   * @type {Map<string, object>}
   */
  const modules = new Map();

  /* Discover modules */
  let entries;
  try {
    entries = fs.readdirSync(modulesDir, { withFileTypes: true });
  } catch {
    log('WARN', 'module-loader', `Modules directory not found: ${modulesDir}`);
    return { dispatch, unloadAll };
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const indexPath = path.join(modulesDir, entry.name, 'index.js');
    if (!fs.existsSync(indexPath)) continue;

    let mod;
    try {
      mod = require(indexPath);
    } catch (err) {
      log('ERROR', 'module-loader', `Failed to load module "${entry.name}": ${err.message}`);
      continue;
    }

    if (!mod.events || typeof mod.events !== 'object') {
      log('WARN', 'module-loader', `Module "${entry.name}" has no events map, skipping`);
      continue;
    }

    const actionNames = [];
    for (const [action, handler] of Object.entries(mod.events)) {
      if (typeof handler !== 'function') {
        log(
          'WARN',
          'module-loader',
          `Handler "${entry.name}:${action}" is not a function, skipping`,
        );
        continue;
      }
      routes.set(`${entry.name}:${action}`, handler);
      actionNames.push(action);
    }

    modules.set(entry.name, mod);

    /* Call onLoad hook if present */
    if (typeof mod.onLoad === 'function') {
      try {
        mod.onLoad(coreServices);
      } catch (err) {
        log('ERROR', 'module-loader', `onLoad failed for "${entry.name}": ${err.message}`);
      }
    }

    log('INFO', 'module-loader', `Loaded module "${entry.name}" [${actionNames.join(', ')}]`);
  }

  log(
    'INFO',
    'module-loader',
    `${modules.size} module(s) loaded, ${routes.size} route(s) registered`,
  );

  /**
   * Dispatches an event string to the matching handler.
   *
   * @param {object} ctx     - Connection context.
   * @param {string} event   - Event string in "module:action" format.
   * @param {object} payload - Client payload.
   * @returns {Promise<object>} Handler result.
   * @throws {{ code: string, message: string }} Structured error.
   */
  async function dispatch(ctx, event, payload) {
    const sepIndex = event.indexOf(':');
    if (sepIndex === -1) {
      const err = new Error(`Invalid event format: "${event}"`);
      err.code = 'INVALID_PAYLOAD';
      throw err;
    }

    const moduleName = event.slice(0, sepIndex);
    const action = event.slice(sepIndex + 1);

    if (!modules.has(moduleName)) {
      const err = new Error(`Module "${moduleName}" not found`);
      err.code = 'MODULE_NOT_FOUND';
      throw err;
    }

    const handler = routes.get(event);
    if (!handler) {
      const err = new Error(`Action "${action}" not found in module "${moduleName}"`);
      err.code = 'ACTION_NOT_FOUND';
      throw err;
    }

    /* Execute handler with timeout */
    let timer;
    const timeoutPromise = new Promise((_resolve, reject) => {
      timer = setTimeout(() => {
        const err = new Error(`Handler "${event}" timed out after ${handlerTimeoutMs}ms`);
        err.code = 'INTERNAL_ERROR';
        reject(err);
      }, handlerTimeoutMs);
    });

    return Promise.race([handler(ctx, payload), timeoutPromise]).finally(() => {
      clearTimeout(timer);
    });
  }

  /**
   * Calls `onUnload` on every loaded module for graceful shutdown.
   */
  function unloadAll() {
    for (const [name, mod] of modules) {
      if (typeof mod.onUnload === 'function') {
        try {
          mod.onUnload();
        } catch (err) {
          log('ERROR', 'module-loader', `onUnload failed for "${name}": ${err.message}`);
        }
      }
    }
  }

  return { dispatch, unloadAll };
}

module.exports = { loadModules, HANDLER_TIMEOUT_MS };
