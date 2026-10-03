# SentinelLab plan

SentinelLab is a web app for running security checks against applications you own or have written permission to test. You register a target, confirm you are authorized to test it, start a scan, review the findings, track fixes, and export a report.

This file records where the project stands and what comes next. Update it at the end of each milestone.

## Scope rules

These rules apply to every milestone:

- SentinelLab only scans targets that a signed-in user has registered and marked as authorized.
- The API refuses target URLs that resolve to private, loopback, or link-local addresses. The only exceptions are the local demo targets on the Docker network, and you have to turn them on explicitly.
- The demo apps in `targets/` are intentionally vulnerable. Each page shows the banner "INTENTIONALLY VULNERABLE — LOCAL SECURITY TRAINING TARGET", and they bind to `127.0.0.1` only.
- Checks look for signs of a problem and record evidence. They do not modify or delete data, keep access, or collect credentials.
- No `.env` files, secrets, tokens, or database dumps go into git.

## Where the code lives

SentinelLab lives in the public repo [work-frame/sentinellab](https://github.com/work-frame/sentinellab). Work happens on `main` in small, tested commits, one or more per milestone.

The first commit started in the `sentinellab/` folder of `work-frame/Medverify-` and moved here with `git subtree split`, so its history carried over.

## Environment

Checked on 2026-10-03 in the cloud container:

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 22.22.0 | |
| npm | 10.9.4 | |
| pnpm | 10.28.0 | Workspace package manager |
| git | 2.43.0 | |
| GitHub CLI | 2.89.0 | Installed, token invalid |
| Docker | 29.6.2 | You have to start the daemon by hand (`dockerd`) |
| Docker Compose | v5.3.1 | |
| Free disk | about 30 GB | |

`postgres:16-alpine` and `redis:7-alpine` pull without problems.

## Stack decisions

| Area | Choice | Reason |
| --- | --- | --- |
| API | NestJS 11 | NestJS 12 ships as ESM only, which makes the Jest setup harder |
| Language | TypeScript 5.9 | ts-jest doesn't support TypeScript 7 yet |
| ORM | Prisma 6.19 | Prisma 8 is still a release candidate |
| Web | Next.js 16, Tailwind CSS | |
| Jobs | BullMQ on Redis | Keeps long scans out of the request cycle |
| Database | PostgreSQL 16 | |
| Tests | Jest, Supertest, Playwright | Chromium is already installed in `/opt/pw-browsers` |

## Milestones

Each milestone follows the same loop: read the existing code, make the smallest coherent change, run tests, lint, and typecheck, review the diff, then commit and push.

### 1. Foundation (in progress)

Done:

- Folder layout: `apps/api`, `apps/web`, `packages/types`, `packages/config`, `infrastructure/`, `docs/`, `tests/`
- Root `package.json` and `pnpm-workspace.yaml`
- `.gitignore`, which blocks `.env` files, keys, and dumps
- `.env.example` with placeholder values only
- `docker-compose.yml` for Postgres and Redis, with ports bound to `127.0.0.1` and health checks

Still to do:

- NestJS API skeleton with a health endpoint, config validation, Helmet, and Swagger at `/api/docs`
- Prisma schema and first migration for users, targets, scans, findings, evidence, scan modules, reports, and audit logs, with indexes
- Next.js app shell with the navigation: Dashboard, Targets, Scans, Findings, Reports, Demo Lab, Settings
- README, CONTRIBUTING, SECURITY, LICENSE
- Install, build, and run the first tests, then commit as `feat: initialize SentinelLab monorepo`

### 2. Authentication and audit logging

Registration, login, and logout. Argon2 password hashing, HTTP-only session cookies, CSRF protection, and rate limits on auth routes. Audit log entries for security events, with passwords and tokens never written to logs. Tests cover login, bad credentials, rate limits, and access to protected routes.

### 3. Target management

Create, edit, disable, delete, and view targets. Users must confirm authorization before a target can be scanned. URL validation blocks requests to internal networks (SSRF protection), and every query checks ownership so users can't reach each other's targets.

### 4. Scan jobs

Scan states: queued, running, completed, failed, cancelled. BullMQ workers run the scans, and the API reports progress, supports cancellation, and keeps a history of past scans.

### 5. Security engine

A separate package, `packages/security-engine`, with one module per check and a test file for each. The first checks are passive: response headers, cookie flags, CORS policy, server banners, and allowed HTTP methods. The engine normalizes findings, assigns severity, and stores evidence with secrets redacted.

### 6. Findings and reports

Finding list and detail pages with status changes (Open, Confirmed, False Positive, Resolved, Accepted Risk). Reports cover scope, method, findings, and remediation, and say plainly that a clean scan does not prove an app is secure.

### 7. Demo lab and CI

Local Docker demo targets that SentinelLab can scan, plus Playwright end-to-end tests and a GitHub Actions workflow for lint, typecheck, tests, build, and dependency audit.

The details of milestones 5 and 7 get settled when work starts on them, and this file will record them then.
