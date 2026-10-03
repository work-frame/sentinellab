# Development guide

## Prerequisites

- Node.js 22 (`node -v`)
- pnpm 10: run `corepack enable` once and the version pinned in `package.json` is used
- Docker with Compose v2

## First run

```bash
pnpm install
cp .env.example .env                              # set POSTGRES_PASSWORD and match it in DATABASE_URL
docker compose -f docker-compose.dev.yml up -d   # Postgres :5432, Redis :6379, demo targets :8081/:8082
pnpm db:migrate                                   # apply migrations
pnpm dev                                          # builds shared packages, then API :4000 and web :3000
```

Open http://localhost:3000 and register. The first account becomes the admin.

## Scripts

Run these from the repository root.

| Script | What it does |
| --- | --- |
| `pnpm dev` | Builds `types` and `security-engine`, then runs the API (`nest start --watch`) and web (`next dev`) |
| `pnpm build` | Builds packages and apps |
| `pnpm lint` | ESLint in every package |
| `pnpm typecheck` | TypeScript without emitting |
| `pnpm test` | Unit tests |
| `pnpm test:integration` | API integration tests (needs the dev compose stack) |
| `pnpm test:e2e` | Playwright (needs the full stack on :3000) |
| `pnpm db:up` | Same as `docker compose -f docker-compose.dev.yml up -d` |
| `pnpm db:migrate` | `prisma migrate deploy` |
| `pnpm audit` | Production dependency audit, fails on high or critical |

Per-package scripts work with `--filter`, for example `pnpm --filter @sentinellab/security-engine test`.

## Environment

The API reads the root `.env` (scripts pass `--env-file-if-exists=../../.env`). The web app reads `NEXT_PUBLIC_API_URL` at build time. See `.env.example` for every variable.

## Database

The schema is `apps/api/prisma/schema.prisma`.

```bash
# after editing the schema
pnpm --filter @sentinellab/api prisma:migrate --name add_something

# open Prisma Studio
pnpm --filter @sentinellab/api prisma studio
```

Commit the new folder under `apps/api/prisma/migrations`.

Integration tests use a database named like your `DATABASE_URL` database plus `_test` (or `TEST_DATABASE_URL`). Global setup runs `prisma migrate deploy`, which creates the database if needed and never drops data. Each test registers new users with unique emails, so leftover rows do not affect results.

## Queues

BullMQ keys use the prefix `sentinellab-<NODE_ENV>` by default (`QUEUE_PREFIX` overrides it). That keeps a running dev server from picking up jobs created by the integration tests, which share the same Redis.

## Demo targets

With the dev compose file the demo targets listen on `127.0.0.1:8081` and `127.0.0.1:8082`, and the default `DEMO_TARGETS` points at those addresses. You can also run them without Docker:

```bash
PORT=8081 HOST=127.0.0.1 node targets/vulnerable-web/server.js
PORT=8082 HOST=127.0.0.1 node targets/vulnerable-api/server.js
```

## End-to-end tests

```bash
REGISTER_RATE_LIMIT=100 docker compose up -d --build   # or run API and web locally with the same variable
pnpm test:e2e
```

Set `PLAYWRIGHT_CHROMIUM_PATH` to use a Chromium that is already installed, and `E2E_SCREENSHOT_DIR` to save full-page screenshots of the main screens.

## API documentation

Swagger UI: http://localhost:4000/api/docs. Raw OpenAPI JSON: http://localhost:4000/api/docs/openapi.json. Both come from the controller and DTO decorators, so they stay in sync with the code. To try state-changing endpoints in Swagger UI, sign in through `POST /api/auth/login` first and add the header `x-sentinellab-csrf: 1`.

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `Missing required environment variable DATABASE_URL` | No `.env` at the repository root. Copy `.env.example`. |
| Login works but every request returns 401 | `NEXT_PUBLIC_API_URL` and the page are on different sites (for example `127.0.0.1` vs `localhost`), so the browser does not send the cookie. Use the same host name for both. |
| `403 Origin not allowed` | Add the web app's origin to `WEB_ORIGIN`. |
| Scans stay `QUEUED` | Redis is down, or another process with the same `QUEUE_PREFIX` but a different database is taking the jobs. |
| Scan fails with "not on the allowlist" | The target resolves to a local address. Use a demo target, or add the exact `host:port` to `SCANNER_PRIVATE_ALLOWLIST` if you really mean to scan a local service you own. |
| `Too many requests` when running e2e tests | Raise `REGISTER_RATE_LIMIT` for the API process. |
