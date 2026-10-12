# FlowlyWeb for BigBlueButton

Source code of [FlowlyWeb](https://flowlyweb.com), which brought theming and engagement tools
(question highlighting, mentions, GIFs, moderator badges, self-renaming) to BigBlueButton rooms.

> **FlowlyWeb is discontinued.** Recent BigBlueButton updates changed the foundations it relied
> on, and we could no longer meet our customers' needs. The code is published as is, for reference
> and for anyone who wants to build on it. It is not maintained: there are no releases, no support
> and no security fixes. Review it before running it anywhere.
>
> The team now works on [Vuisio](https://vuisio.com), a French video conferencing platform with
> no US dependencies.

## Components

| Folder                            | What it is                                                            | Runs on                          |
| --------------------------------- | --------------------------------------------------------------------- | -------------------------------- |
| [`plugin/`](plugin)               | BigBlueButton HTML plugin (React), bundles for BBB 3.0 and 3.1        | The participant's browser        |
| [`plugin-server/`](plugin-server) | WebSocket bridge to the BBB backend (Node.js)                         | The BigBlueButton server         |
| [`api/`](api)                     | REST API: institutions, accounts, themes, quotas (NestJS, PostgreSQL) | A server reachable from browsers |

```
┌────────────────────────┐                               ┌────────────────────────┐
│ plugin                 │   wss /flowly-plugin-server   │ plugin-server          │
│ (BBB client, browser)  │ ────────────────────────────▶ │ (BBB server)           │
└────────────────────────┘                               └────────────────────────┘
            │ HTTPS /api/institutions/styles, /api/servers/*
            ▼
┌────────────────────────┐
│ api                    │
│ (REST, PostgreSQL)     │
└────────────────────────┘
```

Each folder is a standalone project with its own `package.json`, lockfile and README. The
dashboard used to manage institutions and the billing service are not included.

## License

Copyright (C) 2026 Geezot.

Released under the [GNU Affero General Public License v3.0](LICENSE). If you run a modified
version of this code for other people, you must make your source code available to them.
