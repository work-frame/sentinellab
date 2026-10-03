# Contributing to SentinelLab

Thanks for helping. This guide covers how to set up, what a good change looks like, and the rules that keep SentinelLab safe to use.

## Ground rules for scanner changes

SentinelLab exists for authorized testing. Every check must follow these rules:

1. Send only safe methods (GET, HEAD, OPTIONS) unless a maintainer agrees otherwise in an issue first.
2. Never send requests that create, change or delete data on the target.
3. Detect and record evidence. Do not exploit, persist, collect credentials or try to evade detection.
4. Every outbound request goes through `safeRequest` in `packages/security-engine`, so the SSRF guard and timeouts apply.
5. Redact secrets before evidence is stored. Add a test that proves it.

Pull requests that add attack tooling, stealth features or scanning of arbitrary third-party systems will be closed.

## Setup

Follow [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). The short version:

```bash
corepack enable
pnpm install
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
pnpm db:migrate
pnpm dev
```

## Making a change

1. Open an issue for anything larger than a bug fix, so we can agree on the approach.
2. Branch from `main`: `feat/short-name`, `fix/short-name`, `security/short-name` or `docs/short-name`.
3. Keep the change focused. A refactor and a feature go in separate pull requests.
4. Add or update tests:
   - a new check needs unit tests with fixtures for both the positive and the negative case
   - a new API route needs integration tests, including one that proves another user cannot reach the resource
5. Run the same checks CI runs:

   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration
   ```

6. Update the docs when behavior changes (README, `docs/SCANNER.md`, Swagger decorators).

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add HSTS preload check
fix: keep finding status when a scan is cancelled
security: re-check DNS before each redirect
test: cover cookie redaction in evidence
docs: explain the demo lab network
```

## Database changes

Edit `apps/api/prisma/schema.prisma`, then create a migration:

```bash
pnpm --filter @sentinellab/api prisma:migrate --name describe_the_change
```

Commit the generated folder under `prisma/migrations`. Never edit a migration that is already on `main`.

## Secrets

Never commit `.env`, keys, tokens, passwords or database dumps. If you commit one by accident, tell a maintainer right away; rotating the secret matters more than rewriting history.

## Reporting vulnerabilities

Do not open a public issue for a security problem in SentinelLab. Follow [SECURITY.md](SECURITY.md).
