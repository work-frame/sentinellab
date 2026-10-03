# How SentinelLab protects itself

SentinelLab accepts URLs from users and makes HTTP requests to them, stores findings that can describe weaknesses in real systems, and holds user accounts. This page lists the threats that matter for that and the control for each one, with the test that covers it.

To report a vulnerability, see the [security policy](../SECURITY.md).

## Threat model

| Asset | Threat | Main controls |
| --- | --- | --- |
| Internal network and cloud metadata | A user registers `http://169.254.169.254/` or an internal host as a target (SSRF) | Target policy, DNS checked at save, at scan and at connect time |
| Other people's systems | The scanner is used against systems without permission | Authorization confirmation, safe methods only, same-host redirects only |
| Findings and reports | Another user reads or changes them (IDOR) | Every query is scoped to the owner; foreign ids return 404 |
| Sessions | Theft through XSS, cross-site requests or a database leak | HttpOnly SameSite cookie, CSRF header, hashed tokens |
| Accounts | Password guessing | Argon2id, rate limits, lockout, identical error messages |
| Evidence | Secrets from target responses end up stored | Redaction before storage |
| Audit trail | Spoofed client IPs, credentials in logs | No proxy trust by default, metadata sanitizer |

## Controls

### SSRF and target restrictions

`packages/security-engine/src/http/target-policy.ts`

- Only `http` and `https`; URLs with embedded credentials are refused.
- Every address a hostname resolves to must be public unicast. A single internal record fails the whole host.
- Link-local (including `169.254.169.254`), unspecified, broadcast, multicast and reserved ranges are always blocked.
- Private, loopback, unique-local and carrier-grade NAT ranges are allowed only for exact `host:port` pairs on the allowlist. The allowlist is built from `DEMO_TARGETS` plus the optional `SCANNER_PRIVATE_ALLOWLIST`.
- IPv4-mapped IPv6 addresses are unwrapped first. Decimal and hex IPv4 forms (`2130706433`, `0x7f000001`) are normalized by the URL parser before the check.
- The check runs when a target is saved, again when a scan is queued, and a third time inside the TCP connect (custom DNS lookup in the undici agent). The third check stops DNS rebinding.
- Redirects are followed by hand, at most 5, and only while they stay on the starting host.
- Requests time out after 10 seconds, and at most 64 KB of each body is read.

Tests: `target-policy.test.ts`, `scanner.integration.test.ts`, `targets.e2e-spec.ts` (8 SSRF cases), Playwright `security.spec.ts`.

### Authorization to test

- A target cannot be scanned until its owner confirms authorization. The confirmation time and optional note are stored and appear in the report scope.
- Changing a target's URL clears the confirmation.
- Scans re-check the enabled flag and the confirmation when the worker starts.
- The scanner only sends GET and OPTIONS. Write methods are never sent, only reported when a server advertises them.

### Authentication and sessions

- Passwords: argon2id, 19 MiB memory, 2 iterations (OWASP baseline), 12 to 128 characters, must not contain the email name.
- Unknown emails are verified against a dummy hash so response time does not reveal which accounts exist. Wrong password, unknown email and locked account all return the same message.
- Lockout: 10 failed passwords lock the account for 15 minutes, whatever IP they come from.
- Rate limits per IP: 10 logins per minute, 5 registrations per 10 minutes, 300 requests per minute overall.
- Sessions: 32 random bytes, stored only as SHA-256. The cookie is `HttpOnly`, `SameSite=Lax`, `Secure` in production, and expires after 12 hours. Logout deletes the session row.

### Authorization inside the app (IDOR)

Every service method that loads a target, scan, finding or report filters by the owner in the same query. There is no "load by id, then check" pattern to forget. Integration tests sign in as a second user and try GET, PATCH, DELETE, scan, authorize, report download and report generation on the first user's resources; all return 404.

### CSRF

- Every POST, PATCH and DELETE must carry `X-SentinelLab-CSRF: 1`. Browsers only send custom headers cross-origin after a CORS preflight, and CORS only allows `WEB_ORIGIN`.
- If an `Origin` header is present it must be in `WEB_ORIGIN`.
- The session cookie is `SameSite=Lax`.

### Input validation and injection

- DTOs with `class-validator`; `whitelist` and `forbidNonWhitelisted` reject unknown fields, which blocks mass assignment of `ownerId`, `isDemo` or `role`.
- Route ids go through `ParseUUIDPipe`.
- All database access uses Prisma's parameterized queries. The only raw query is the constant `SELECT 1` health check.
- No user input reaches a shell, the file system or `eval`.

### Output encoding and XSS

- React escapes all text. The codebase has no `dangerouslySetInnerHTML`, and the lint step (which CI runs) fails if one appears.
- Evidence bodies are shown inside `<pre>` as text.
- Finding reference links are rendered only for `http` and `https` URLs.
- The HTML report escapes every dynamic value and is served with `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'` as a download.
- Markdown reports escape characters that would change structure or inject HTML.
- Login redirects accept only same-site paths (`safeNextPath`).

### Security headers

- API: helmet with a strict CSP, `frame-ancestors 'none'`, `nosniff`, no `X-Powered-By`.
- Web: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, no `X-Powered-By`.

### Error handling

A global filter returns `{ statusCode, message }`. Unexpected errors become "Internal server error" and the details go to the server log. Scan failures are translated into fixed messages such as "Connection refused. Is the target running?".

### Evidence redaction

`packages/security-engine/src/http/redact.ts` replaces, before storage:

- cookie values in `Set-Cookie` (names and attributes stay)
- `Authorization`, `Cookie`, `X-API-Key` and similar headers
- JWTs, AWS access key ids, private key blocks
- JSON fields and query parameters named like `password`, `token`, `secret`, `api_key`

Tests assert that a session cookie value from a target never appears in stored findings, API responses or reports.

### Audit logging

Recorded actions: `auth.register`, `auth.login`, `auth.login_failed`, `auth.logout`, `target.created`, `target.updated`, `target.authorized`, `target.disabled`, `target.enabled`, `target.deleted`, `scan.started`, `scan.cancelled`, `finding.status_changed`, `report.generated`.

Metadata goes through a sanitizer that replaces any key that looks like a password, token, secret, API key, cookie or credential. A test checks that a registered password never appears in the log.

### Client IP handling

The API does not trust `X-Forwarded-For` unless `TRUST_PROXY` is set. Set it only when a reverse proxy you control overwrites that header; otherwise any client could choose its own IP and dodge rate limits.

### Containers and supply chain

- Non-root `node` user, read-only root filesystem, all capabilities dropped, `no-new-privileges`.
- Postgres and Redis are not published in the full stack; the demo targets sit on an internal network without internet access.
- `pnpm audit --prod --audit-level high` runs in CI. Patched versions of two transitive packages are pinned with overrides.
- CodeQL (`security-extended`) runs on every push, pull request and weekly. Dependabot opens weekly update pull requests.
- `.env`, keys and dumps are git-ignored; `.env.example` holds placeholders only.

## Known limitations

- The web CSP allows inline scripts, which Next.js needs unless nonces are wired in through a proxy file. This weakens CSP as an XSS backstop; the primary defense is React escaping.
- Rate limit counters live in memory. Several API instances would each keep their own counters.
- Account lockout can be triggered on purpose by someone who knows an email address.
- No multi-factor authentication, password reset or "sign out everywhere" yet.
- The registration endpoint returns a generic message for an existing email, but a determined attacker can still learn which emails exist through timing of the registration path.

## Testing SentinelLab itself

| Area | Where |
| --- | --- |
| IDOR, broken authorization | `apps/api/test/targets.e2e-spec.ts`, `scans.e2e-spec.ts` |
| SSRF | `target-policy.test.ts`, `targets.e2e-spec.ts`, Playwright `security.spec.ts` |
| Injection, mass assignment | `targets.e2e-spec.ts`, `auth.e2e-spec.ts` |
| XSS | `report-renderer.spec.ts`, web `components.test.tsx`, Playwright `security.spec.ts` |
| Authentication bypass, CSRF | `auth.e2e-spec.ts` |
| Rate limits, lockout | `auth.e2e-spec.ts` |
| Insecure configuration | `auth.e2e-spec.ts` (headers, CORS), network isolation checked manually with `docker compose exec` |
