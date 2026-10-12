# Flowly plugin for BigBlueButton

Client-side plugin that brought theming and engagement tools to BigBlueButton rooms. It was the
core of [FlowlyWeb](https://flowlyweb.com).

> **FlowlyWeb is discontinued.** Recent BigBlueButton updates changed the foundations this plugin
> relied on, and we could no longer meet our customers' needs. The code is published as is, for
> reference and for anyone who wants to build on it. It is not maintained and issues will not be
> answered.
>
> The team now works on [Vuisio](https://vuisio.com), a French video conferencing platform with
> no US dependencies.

## Features

| Module         | What it does                                                           |
| -------------- | ---------------------------------------------------------------------- |
| `company`      | Applies an institution theme: colors, logo, backgrounds, favicon       |
| `questions`    | Detects questions in the public chat and highlights them               |
| `mentions`     | `@` mention suggestions and highlighting in the chat                   |
| `moderator`    | Moderator badges and highlighted moderator messages                    |
| `gif`          | GIF picker (Giphy) and inline GIF rendering in the chat                |
| `usernames`    | Lets participants rename themselves during a meeting                   |
| `presentation` | Download options in the upload dialog (BBB 3.0), themed download icons |
| `screenshare`  | Larger self-preview and an overlay while you share your screen         |
| `heartbeat`    | Reports active meetings to the API for concurrent usage quotas         |

Each module can be switched on or off by the theme configuration returned by the API.

Two bundles are built from the same source, one for **BigBlueButton 3.0** and one for
**BigBlueButton 3.1**.

## What you need to run it

The plugin is only the browser side of FlowlyWeb. On its own, it loads but shows a license error
and disables its modules. It expects:

- **An HTTP API** (`FLOWLY_API_URL`), which validates the domain and serves the theme:
  - `GET  /api/institutions/styles`: theme and enabled modules, identified by the `Origin` header
  - `POST /api/servers/heartbeat`: moderator heartbeat
  - `GET  /api/servers/check-quota` and `GET /api/servers/quota-info`: concurrent usage quota
- **A WebSocket server** at `wss://<bbb-host>/flowly-plugin-server`, used by the `usernames`
  module (`user:rename` request, `user:renamed` push). The handshake sends the BBB
  `sessionToken` in a `connection_init` message.

Neither server is part of this repository. See [`src/types/api.ts`](src/types/api.ts) and
[`src/services/`](src/services) for the exact payloads.

## Development

Requirements: Node.js 20+ and pnpm 10.

```bash
pnpm install
cp .env.example .env   # then edit the values
pnpm start             # dev server on http://localhost:4701
```

The dev server exposes one manifest per BBB version:

- `http://localhost:4701/3.0/manifest.json`
- `http://localhost:4701/3.1/manifest.json`

Pass the manifest to BigBlueButton when creating a meeting, through the `pluginManifests`
parameter of the `create` API call:

```
pluginManifests=[{"url": "http://localhost:4701/3.1/manifest.json"}]
```

To serve the dev server over HTTPS, put `key.pem` and `cert.pem` in a `certs/` folder.

Other scripts:

```bash
pnpm lint         # ESLint + Prettier
pnpm type-check   # TypeScript
pnpm test         # Vitest
pnpm build:all    # Production bundles in dist-3.0/ and dist-3.1/
```

## Configuration

| Variable            | Used at | Description                                                  |
| ------------------- | ------- | ------------------------------------------------------------ |
| `FLOWLY_API_URL`    | build   | API base URL, without the `/api` suffix                      |
| `FLOWLY_PLUGIN_URL` | build   | Public URL the bundles are served from, written in manifests |
| `GIPHY_API_KEY`     | build   | Giphy key; the GIF picker is disabled without it             |
| `BBB_VERSION`       | build   | `3.0` or `3.1` (set by the `build:*` scripts)                |

If `FLOWLY_API_URL` or `FLOWLY_PLUGIN_URL` is missing, the production bundles keep the
`__FLOWLY_API_URL__` and `__FLOWLY_PLUGIN_URL__` placeholders so they can be filled later.

## Docker

The image builds both bundles and serves them with nginx under `/3.0/` and `/3.1/`. Placeholders
are replaced when the container starts:

```bash
docker build -t flowly-plugin-bbb .
docker run -p 3003:80 \
  -e FLOWLY_API_URL=https://api.example.com \
  -e FLOWLY_PLUGIN_URL=https://plugin.example.com \
  flowly-plugin-bbb
```

`GIPHY_API_KEY` is read at build time. To enable GIFs, add
`--build-arg GIPHY_API_KEY=<your key>` to `docker build`.

## How it works

- `src/index.tsx` registers the plugin with the
  [BigBlueButton HTML plugin SDK](https://github.com/bigbluebutton/bigbluebutton-html-plugin-sdk).
- `src/FlowlyPlugin.tsx` validates the license, loads the theme, then mounts the enabled modules.
- `src/modules/` holds one folder per feature. Modules receive the SDK through `PluginContext`.
- `src/services/` holds static singleton services (API, theme, WebSocket, Giphy, quota).
- The plugin tags BBB DOM elements with `data-flowly` attributes and injects CSS that targets
  them. BBB DOM changes between versions are the main source of breakage.
- The workspace code is read from the `workspace` query parameter of the plugin script URL, which
  BBB fills from `${plugin_FlowlyPlugin_workspace:}` in the manifest.

## License

**LICENSE_SECTION**
