'use strict';

if (process.argv.includes('--version') || process.argv.includes('-v')) {
  const { version } = require('./package.json');
  // eslint-disable-next-line no-console
  console.log(`flowly-plugin-server v${version}`);
  process.exit(0);
}

const path = require('path');
const { createWSServer } = require('./core/ws-server');
const { authenticate } = require('./core/auth');
const { createContext } = require('./core/context');
const { loadModules } = require('./core/module-loader');

const { Pool } = require('pg');
const Redis = require('ioredis');
const { initRoleSubscriber } = require('./core/redis-subscriber');

const PORT = parseInt(process.env.PORT, 10) || 8094;
const HOST = process.env.HOST || '127.0.0.1';

/* ------------------------------------------------------------------
 * Logger
 * ---------------------------------------------------------------- */

/**
 * Formats a log line following the project logging convention.
 * @param {'INFO'|'WARN'|'ERROR'} level
 * @param {string} mod   - Module/component name.
 * @param {string} message
 * @returns {string}
 */
function log(level, mod, message) {
  const ts = new Date().toISOString().replace('T', ' ').replace('Z', '');
  return `[${ts}] [${level}] [${mod}] ${message}`;
}

/**
 * Logger wrapper that prints to stdout/stderr.
 * @param {'INFO'|'WARN'|'ERROR'} level
 * @param {string} mod
 * @param {string} message
 */

function logger(level, mod, message) {
  const line = log(level, mod, message);
  if (level === 'ERROR') {
    console.error(line); // eslint-disable-line no-console
  } else {
    console.log(line); // eslint-disable-line no-console
  }
}

/* ------------------------------------------------------------------
 * Load modules
 * ---------------------------------------------------------------- */

/* ------------------------------------------------------------------
 * PostgreSQL pool
 * ---------------------------------------------------------------- */

const coreServices = {};

if (process.env.PG_HOST) {
  const pool = new Pool({
    host: process.env.PG_HOST,
    port: parseInt(process.env.PG_PORT, 10) || 5432,
    database: process.env.PG_DB || 'hasura_app',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || '',
  });

  pool.on('error', (err) => {
    logger('ERROR', 'pg', `Pool error: ${err.message}`);
  });

  coreServices.pg = pool;
  logger(
    'INFO',
    'pg',
    `Pool created for ${process.env.PG_HOST}:${process.env.PG_PORT || 5432}/${process.env.PG_DB || 'hasura_app'}`,
  );
} else {
  logger('WARN', 'pg', 'PG_HOST not set — PostgreSQL disabled');
}

/* ------------------------------------------------------------------
 * Redis (ioredis) — used for Akka pub/sub and role subscriber
 * ---------------------------------------------------------------- */

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT, 10) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

/** Main Redis client for pub/sub publishing (context.publishToAkka). */
const redisPublisher = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 500, 5000),
});

redisPublisher
  .connect()
  .then(() => {
    logger('INFO', 'redis', `Publisher connected to ${REDIS_HOST}:${REDIS_PORT}`);
  })
  .catch((err) => {
    logger('WARN', 'redis', `Publisher connection failed: ${err.message} — will retry`);
  });

coreServices.redis = redisPublisher;

/**
 * Separate subscriber client — ioredis requires a dedicated connection
 * for subscribe mode (no other commands can be issued on it).
 */
const redisSubscriber = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  lazyConnect: true,
  retryStrategy: (times) => Math.min(times * 500, 5000),
});

redisSubscriber
  .connect()
  .then(() => {
    logger('INFO', 'redis', `Subscriber connected to ${REDIS_HOST}:${REDIS_PORT}`);
  })
  .catch((err) => {
    logger('WARN', 'redis', `Subscriber connection failed: ${err.message} — will retry`);
  });

/* ------------------------------------------------------------------
 * Load modules
 * ---------------------------------------------------------------- */

const modulesDir = path.join(__dirname, 'modules');
const { dispatch, unloadAll } = loadModules(modulesDir, coreServices, logger);

/* ------------------------------------------------------------------
 * Start server
 * ---------------------------------------------------------------- */

const { close, connections } = createWSServer({
  port: PORT,
  host: HOST,
  authenticate,
  dispatch,
  coreServices,
  createContext,
  logger,
  onListening: () => {
    logger('INFO', 'server', `Listening on ${HOST}:${PORT}`);
  },
});

/* ------------------------------------------------------------------
 * Redis role subscriber — detects BBB role promotions via Akka events
 * ---------------------------------------------------------------- */

const roleSubscriber = initRoleSubscriber(redisSubscriber, connections, logger);

/* ------------------------------------------------------------------
 * Graceful shutdown
 * ---------------------------------------------------------------- */

/**
 * Handles SIGINT / SIGTERM for clean shutdown.
 * @param {string} signal - The received signal name.
 */
async function shutdown(signal) {
  logger('INFO', 'server', `Received ${signal}, shutting down…`);
  try {
    unloadAll();
    roleSubscriber.stop();
    await redisSubscriber.quit().catch(() => {});
    await redisPublisher.quit().catch(() => {});
    if (coreServices.pg) await coreServices.pg.end();
    await close();
    logger('INFO', 'server', 'Server closed');
    process.exit(0);
  } catch (err) {
    logger('ERROR', 'server', `Shutdown error: ${err.message}`);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
