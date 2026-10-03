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

Each milestone follows the same loop: read the existing code, make the smallest coherent change, run tests, lint and typecheck, review the diff, then commit and push.

### MVP (done)

| Milestone | Commit | Status |
| --- | --- | --- |
| Foundation: workspace, compose, plan | `17be10e` | Done |
| Shared packages and passive security engine | `7a1c0f0` | Done, 58 tests |
| API: auth, targets, scans, findings, reports, dashboard, audit | `f009936` | Done, 34 integration tests |
| Security fix: no proxy trust by default, strict CORS | `5551258` | Done |
| Demo targets | `1f35e84` | Done |
| Web dashboard and Playwright tests | `957a5fa` | Done, 14 component and 7 end-to-end tests |
| Docker images, compose stacks, CI, CodeQL, Dependabot | `bce2632` | Done |
| Documentation | this commit | Done |

### Next

1. **Active checks for local and development targets.** Reflected XSS, SQL error and command injection indicators using harmless marker values, sent only to targets marked `LOCAL_DEMO` or `DEVELOPMENT`. Add matching weaknesses to the demo targets.
2. **Authorization testing.** Let a user store two test accounts for a target and compare responses for IDOR/BOLA and privilege boundaries. Needs encrypted credential storage first.
3. **Account security.** Password reset, "sign out everywhere", optional TOTP.
4. **Scale-out.** Redis-backed rate limit storage and a separate worker process.
5. **CSP nonces** for the web app, to drop `'unsafe-inline'` from `script-src`.

## Decisions made along the way

- The browser calls the API directly instead of through a Next.js rewrite. The rewrite forwarded client-supplied `X-Forwarded-For` unchanged, which would have let anyone spoof their IP for rate limits and audit logs.
- Integration tests use `prisma migrate deploy` on a dedicated `_test` database instead of `migrate reset`, so the suite never drops data.
- Docker images install no OS packages, so they build behind restrictive networks and stay smaller.
