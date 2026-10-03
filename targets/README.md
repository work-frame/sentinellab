# Demo targets

> INTENTIONALLY VULNERABLE — LOCAL SECURITY TRAINING TARGET

These two small servers exist only to give SentinelLab something to scan. Each one has deliberate configuration weaknesses that match the scanner's checks. Run them only on your own machine through Docker Compose, which publishes their ports on `127.0.0.1`. Never deploy them anywhere.

| Target | Port | Weaknesses |
| --- | --- | --- |
| `vulnerable-web` | 8081 | No CSP, no clickjacking protection, no nosniff or Referrer-Policy, session cookie without HttpOnly/Secure/SameSite, versioned `Server` and `X-Powered-By` headers, TRACE advertised, plain HTTP |
| `vulnerable-api` | 8082 | CORS reflects any origin with credentials, stack traces in error responses, no rate limit headers, write methods advertised, version banner |

Both servers use only Node.js built-ins, so there is nothing to install. They hold no real data and have no database: every page is static text.
