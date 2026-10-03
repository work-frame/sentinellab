# Security policy

This file covers vulnerabilities in SentinelLab itself. The apps in `targets/` are vulnerable on purpose; issues in them are not security reports.

## Supported versions

SentinelLab is pre-1.0. Only the latest commit on `main` receives fixes.

## Reporting a vulnerability

Please report privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue.

Include:

- what you found and where (file, route or page)
- steps to reproduce, ideally against the local Docker setup
- the impact you think it has

You can expect an acknowledgement within 7 days and a status update within 30 days. Once a fix ships, you will be credited in the release notes unless you ask not to be.

## Scope

In scope:

- authentication, session and authorization flaws in the API or web app
- ways to make the scanner reach hosts it should refuse (SSRF), including DNS rebinding and redirect tricks
- secrets leaking into evidence, reports or audit logs
- XSS, CSRF, injection or path traversal in SentinelLab
- container or Compose settings that expose services beyond `127.0.0.1`

Out of scope:

- the intentionally vulnerable demo apps in `targets/`
- missing hardening that is already listed under "Security limitations" in the README
- findings that need a compromised host or a malicious administrator

## Testing rules

Test against your own local installation only. Do not test against other people's deployments.

How SentinelLab protects itself is described in [docs/SECURITY.md](docs/SECURITY.md).
