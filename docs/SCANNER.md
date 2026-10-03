# Scanner

The scanner lives in `packages/security-engine`. It has no dependency on the API or the database, so you can call it from a script or a test.

```ts
import { parsePolicy, runScan } from '@sentinellab/security-engine';

const result = await runScan({
  baseUrl: 'https://staging.example.com/',
  policy: parsePolicy(''), // no private addresses allowed
  onProgress: (e) => console.log(e.module, e.status, e.progress),
});
console.log(result.findings.length, 'findings from', result.requestCount, 'requests');
```

## Pipeline

1. **Recon** (`recon.ts`) collects every HTTP response the checks need.
2. **Checks** (`checks/*.ts`) read those responses and return finding drafts. They send no traffic.
3. **Normalization** (`scanner.ts`) removes duplicate fingerprints and sorts by severity, then title.
4. The API stores findings and evidence and builds reports from them.

A check that throws is recorded as `FAILED` and the scan continues. A recon failure (target down, blocked by policy) fails the scan, because no check could give a valid answer.

## Traffic sent

| # | Request | Purpose |
| --- | --- | --- |
| 1 | `GET <base URL>` | Baseline response |
| 2 to 6 | `GET <Location>` | Same-host redirects only, at most 5 |
| 7 | `OPTIONS <final URL>` | Read the `Allow` header |
| 8 | `GET <final URL>/sentinellab-not-found-<random>` | See how errors are handled |
| 9 | `GET <final URL>` with `Origin: https://sentinellab-cors-probe.invalid` | CORS behavior |

Every request carries `User-Agent: SentinelLab/0.1 (+authorized security testing)` so target owners can find it in their logs. The `.invalid` domain can never resolve, so the CORS probe can't be abused to reach a real origin.

## Checks and severities

Severities are fixed per rule. SentinelLab does not calculate CVSS scores.

| Rule id | Severity | Confidence | Condition |
| --- | --- | --- | --- |
| `headers.csp-missing` | Medium | High | HTML response without `Content-Security-Policy` |
| `headers.clickjacking` | Medium | High | HTML without `X-Frame-Options` or CSP `frame-ancestors` |
| `headers.hsts-missing` | Medium | High | HTTPS response without `Strict-Transport-Security` |
| `headers.nosniff-missing` | Low | High | `X-Content-Type-Options` is not `nosniff` |
| `headers.referrer-policy-missing` | Low | High | HTML without `Referrer-Policy` |
| `cookies.httponly-missing` | Medium for session-like names, else Low | High / Medium | `Set-Cookie` without `HttpOnly` |
| `cookies.secure-missing` | Medium for session-like names, else Low | High | Cookie set over HTTPS without `Secure` |
| `cookies.samesite-weak` | Medium for session-like names, else Low | Medium | No `SameSite`, or `SameSite=None` without `Secure` |
| `transport.no-https` | Medium | High | Final URL is `http:` and no redirect to `https:` |
| `cors.reflected-origin-credentials` | High | High | Probe origin echoed with `Allow-Credentials: true` |
| `cors.reflected-origin` | Medium | High | Probe origin echoed without credentials |
| `cors.wildcard-credentials` | Medium | High | `*` together with `Allow-Credentials: true` |
| `cors.wildcard` | Informational | Medium | `Access-Control-Allow-Origin: *` |
| `disclosure.server-version` | Low | High | `Server` header contains a version number |
| `disclosure.x-powered-by` and similar | Low | High | `X-Powered-By`, `X-AspNet-Version`, `X-AspNetMvc-Version`, `X-Generator` present |
| `methods.trace-enabled` | Low | Medium | `OPTIONS` lists `TRACE` or `TRACK` |
| `methods.write-methods-advertised` | Informational | Low | `OPTIONS` lists `PUT`, `DELETE` or `PATCH` on the base path |
| `errors.verbose-error` | Medium | High | Stack trace or SQL error text in the baseline or not-found response |
| `errors.server-error-on-missing-path` | Low | Medium | Unknown path returns 5xx without a stack trace |
| `ratelimit.no-headers` | Informational | Low | No `RateLimit`, `X-RateLimit` or `Retry-After` headers |

"Session-like" cookie names match `sess`, `sid`, `token`, `auth`, `jwt`, `login` or `remember`.

## Evidence

Each finding stores one or more evidence items: a one-line summary, the request (method, URL, headers) and the response (status, headers, and for error findings a body excerpt of up to 1,500 characters). Redaction runs before anything is stored; see [SECURITY.md](SECURITY.md#evidence-redaction).

## Fingerprints

`sha256(ruleId, method, endpoint, discriminator)`, where the discriminator separates findings of the same rule on the same endpoint, such as the cookie name. The same issue gets the same fingerprint in every scan, which is how review decisions carry over.

## Adding a check

1. Create `src/checks/<name>.ts` exporting a `CheckModule` with a unique `name`.
2. Read only from the `ReconResult`. If you need a new kind of response, add it to `recon.ts` with a safe method and explain why in the PR.
3. Use `makeFinding()` and `evidenceFrom()` from `checks/util.ts`, so fingerprints and redaction stay consistent.
4. Pick a fixed severity and confidence and document them in the table above.
5. Register the check in `checks/index.ts`.
6. Add unit tests for a positive and a negative case, and make sure the "hardened site produces no findings" test still passes.

## Not covered yet

These areas appear in the original brief and are not implemented, because they need active test traffic that must be designed carefully:

- reflected XSS, SQL injection and command injection detection
- IDOR, BOLA and privilege boundary tests (these need credentials for two accounts on the target)
- authentication strength checks beyond cookie flags
- discovery of undocumented endpoints
- active rate limit testing (sending bursts)

The plan for each is to send harmless marker values only to targets marked `LOCAL_DEMO` or `DEVELOPMENT`, look for the marker in the response, and never send payloads that change data.
