# Flowly plugin server

WebSocket bridge between the [Flowly plugin](../plugin) running in the BigBlueButton client and the
BBB backend (bbb-web, Redis/Akka, PostgreSQL). It runs on the BigBlueButton server itself.

Plain Node.js (CommonJS), three runtime dependencies: `ws`, `pg`, `ioredis`.

## What it does

- Authenticates each connection with the participant's BBB session token, by asking bbb-web.
- Routes `module:action` events from the plugin to small handlers in `modules/`.
- Pushes events back to one participant or to the whole meeting.
- Follows role changes (moderator promotions) from the Akka Redis channel.

Current modules:

| Event           | Who can call it                                                        | Effect                                                        |
| --------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------- |
| `user:rename`   | Anyone for themselves; moderators for any participant of their meeting | Updates the name in the BBB database and notifies the meeting |
| `example:hello` | Anyone                                                                 | Returns a greeting; shows the module contract                 |

## Protocol

| Direction     | Type              | Shape                                           |
| ------------- | ----------------- | ----------------------------------------------- |
| Client→Server | `connection_init` | `{ type, payload: { sessionToken } }`           |
| Server→Client | `connection_ack`  | `{ type, user, meeting }`                       |
| Client→Server | `event`           | `{ type, id, event: "module:action", payload }` |
| Server→Client | `response`        | `{ type, id, data }`                            |
| Server→Client | `error`           | `{ type, id, error: { code, message } }`        |
| Server→Client | `push`            | `{ type, event, data }`                         |

Before `connection_ack`, every message other than `connection_init` is ignored. Close codes:
`4401` unauthorized, `4408` timeout, `4410` meeting ended, `4500` internal error.

## Configuration

See [`.env.example`](.env.example). The defaults target a standard BBB 3.x server where bbb-web,
Redis and PostgreSQL listen on `127.0.0.1`.

The `user:rename` handler writes to the BBB `bbb_graphql` database. Create a dedicated role for it
instead of using `postgres`:

```bash
sudo -u postgres psql -d bbb_graphql -c "
CREATE USER flowly WITH PASSWORD '<strong-password>';
GRANT CONNECT ON DATABASE bbb_graphql TO flowly;
GRANT USAGE ON SCHEMA public TO flowly;
GRANT SELECT, UPDATE ON TABLE \"user\" TO flowly;
"
```

## Development

```bash
pnpm install
cp .env.example .env
pnpm dev    # nodemon, reads .env (Node.js 20.6+)
pnpm lint
```

With [bbb-docker](https://github.com/bigbluebutton/docker), use the container IPs given in
`.env.example`.

## Install on a BBB server

`pnpm build:deb` (needs `dpkg-deb` and `fakeroot`) produces `dist/flowly-plugin-server_<version>_all.deb`.
The package installs to `/usr/local/bigbluebutton/flowly-plugin-server`, creates a
`flowly-plugin-server` systemd service and an nginx snippet that proxies `/flowly-plugin-server`
to `127.0.0.1:8094`.

```bash
sudo apt install ./dist/flowly-plugin-server_<version>_all.deb
sudo nano /usr/local/bigbluebutton/flowly-plugin-server/.env
sudo ln -s /etc/nginx/sites-available/flowly-plugin-server.conf /etc/bigbluebutton/nginx/flowly-plugin-server.nginx
sudo systemctl restart flowly-plugin-server nginx
```

## Adding a module

Create `modules/<name>/index.js` exporting `{ events: { action: handler } }`, plus optional
`onLoad(coreServices)` / `onUnload()` hooks. A handler is `async (ctx, payload) => data`; throw an
`Error` with a `code` property (`UNAUTHORIZED`, `INVALID_PAYLOAD`, …) to return an error. `ctx`
exposes `user`, `meeting`, `pg`, `redis`, `push`, `broadcast` and `publishToAkka`. Handlers time
out after 10 seconds.

Always scope database access to `ctx.meeting.id`: one BBB server hosts many meetings.
