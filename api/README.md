# Flowly API

REST API behind the [Flowly plugin](../plugin): institutions, user accounts, themes, workspaces,
BigBlueButton settings and concurrent usage quotas.

NestJS 11, TypeORM, PostgreSQL.

## Modules

| Module         | Role                                                                          |
| -------------- | ----------------------------------------------------------------------------- |
| `auth`         | Register, login, refresh tokens, password reset, on-premise first admin setup |
| `institutions` | Institution profile, theme (colors, logo, favicon, modules), BBB settings     |
| `workspaces`   | Sub-organizations with their own style, selected by the plugin `workspace`    |
| `themes`       | Predefined and custom theme templates                                         |
| `servers`      | Plugin heartbeats and concurrent usage quotas                                 |
| `licensing`    | Offline license verification (RS256 JWT) for on-premise installs              |
| `updates`      | On-premise self-update through Watchtower, with database backup and rollback  |
| `emails`       | Transactional emails (Handlebars templates in `templates/emails`)             |

The plugin only uses four public routes: `GET /api/institutions/styles`,
`POST /api/servers/heartbeat`, `GET /api/servers/check-quota` and `GET /api/servers/quota-info`.
It identifies the institution from the `Origin` header of the BBB page.

Everything else needs a JWT from `/api/auth/login` (or an internal API key). Users only reach the
data of their own institution. The OpenAPI documentation is served at `/doc`.

## Deployment modes

`DEPLOYMENT_MODE` selects the behavior:

- `saas` (default): public registration, features gated by pricing tier.
- `onpremise`: registration disabled, the first admin is created through `/api/auth/setup-admin`
  (needs `INTERNAL_API_KEY`), all features unlocked, license checked offline.

The user-facing dashboard and the billing service of FlowlyWeb are not part of this repository.
Without them, manage institutions and themes through the API directly.

## Development

Requirements: Node.js 20+, pnpm 10, PostgreSQL.

```bash
pnpm install
cp .env.example .env   # set DB_*, JWT_SECRET at least
pnpm dev               # http://127.0.0.1:3000/api, docs at http://127.0.0.1:3000/doc
```

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm build             # dist/main.js
```

TypeORM `synchronize` is enabled, so the schema follows the entities on startup. Migrations live in
`src/migrations` (`pnpm migration:run`, `pnpm migration:generate`).

## Docker

```bash
docker build -t flowly-api .
docker run -p 3000:3000 --env-file .env flowly-api
```

The container listens on `0.0.0.0:3000`. Put it behind a reverse proxy with TLS.
