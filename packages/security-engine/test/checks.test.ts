import {
  ALL_CHECKS,
  cookieCheck,
  corsCheck,
  errorDisclosureCheck,
  httpMethodsCheck,
  rateLimitCheck,
  securityHeadersCheck,
  serverDisclosureCheck,
  transportCheck,
} from '../src/checks';
import { exchange, hardenedRecon } from './fixtures';

const ruleIds = (findings: { ruleId: string }[]) => findings.map((f) => f.ruleId).sort();

describe('a hardened site', () => {
  it('produces no findings from any check', () => {
    const recon = hardenedRecon();
    for (const check of ALL_CHECKS) expect({ check: check.name, findings: check.run(recon) }).toEqual({ check: check.name, findings: [] });
  });
});

describe('securityHeadersCheck', () => {
  it('reports every missing header on an HTTPS HTML page', () => {
    const recon = hardenedRecon({ baseline: exchange('https://app.example.com/', 200, { 'content-type': 'text/html' }) });
    expect(ruleIds(securityHeadersCheck.run(recon))).toEqual([
      'headers.clickjacking',
      'headers.csp-missing',
      'headers.hsts-missing',
      'headers.nosniff-missing',
      'headers.referrer-policy-missing',
    ]);
  });

  it('skips HTML-only and HTTPS-only rules for an HTTP JSON API', () => {
    const recon = hardenedRecon({ baseline: exchange('http://api.example.com/', 200, { 'content-type': 'application/json' }) });
    expect(ruleIds(securityHeadersCheck.run(recon))).toEqual(['headers.nosniff-missing']);
  });

  it('accepts frame-ancestors in CSP as clickjacking protection', () => {
    const recon = hardenedRecon();
    expect(securityHeadersCheck.run(recon).some((f) => f.ruleId === 'headers.clickjacking')).toBe(false);
  });
});

describe('cookieCheck', () => {
  it('flags a session cookie without HttpOnly, Secure and SameSite as medium', () => {
    const recon = hardenedRecon({
      baseline: exchange('https://app.example.com/', 200, { 'set-cookie': 'session_id=secretvalue; Path=/' }),
    });
    const findings = cookieCheck.run(recon);
    expect(ruleIds(findings)).toEqual(['cookies.httponly-missing', 'cookies.samesite-weak', 'cookies.secure-missing']);
    expect(findings.every((f) => f.severity === 'MEDIUM')).toBe(true);
  });

  it('never stores the cookie value in evidence', () => {
    const recon = hardenedRecon({
      baseline: exchange('https://app.example.com/', 200, { 'set-cookie': 'session_id=secretvalue; Path=/' }),
    });
    expect(JSON.stringify(cookieCheck.run(recon))).not.toContain('secretvalue');
  });

  it('rates a non-session cookie as low', () => {
    const recon = hardenedRecon({
      baseline: exchange('http://app.example.com/', 200, { 'set-cookie': 'theme=dark; SameSite=Lax' }),
    });
    const findings = cookieCheck.run(recon);
    expect(ruleIds(findings)).toEqual(['cookies.httponly-missing']);
    expect(findings[0]!.severity).toBe('LOW');
  });

  it('treats SameSite=None without Secure as weak', () => {
    const recon = hardenedRecon({
      baseline: exchange('http://app.example.com/', 200, { 'set-cookie': 'auth=x; HttpOnly; SameSite=None' }),
    });
    expect(ruleIds(cookieCheck.run(recon))).toEqual(['cookies.samesite-weak']);
  });
});

describe('transportCheck', () => {
  it('flags plain HTTP without an HTTPS redirect', () => {
    const recon = hardenedRecon({ baseline: exchange('http://app.example.com/', 200) });
    expect(ruleIds(transportCheck.run(recon))).toEqual(['transport.no-https']);
  });

  it('accepts HTTP that redirects to HTTPS', () => {
    const recon = hardenedRecon({
      redirects: [exchange('http://app.example.com/', 301, { location: 'https://app.example.com/' })],
      baseline: exchange('http://app.example.com/', 200),
    });
    expect(transportCheck.run(recon)).toEqual([]);
  });
});

describe('corsCheck', () => {
  const origin = 'https://sentinellab-cors-probe.invalid';
  it('rates a reflected origin with credentials as high', () => {
    const recon = hardenedRecon({
      corsProbe: exchange('https://app.example.com/', 200, {
        'access-control-allow-origin': origin,
        'access-control-allow-credentials': 'true',
      }),
    });
    const [finding] = corsCheck.run(recon);
    expect(finding?.ruleId).toBe('cors.reflected-origin-credentials');
    expect(finding?.severity).toBe('HIGH');
  });

  it('rates a reflected origin without credentials as medium', () => {
    const recon = hardenedRecon({ corsProbe: exchange('https://app.example.com/', 200, { 'access-control-allow-origin': origin }) });
    expect(corsCheck.run(recon)[0]?.severity).toBe('MEDIUM');
  });

  it('rates a plain wildcard as informational', () => {
    const recon = hardenedRecon({ corsProbe: exchange('https://app.example.com/', 200, { 'access-control-allow-origin': '*' }) });
    expect(corsCheck.run(recon)[0]?.severity).toBe('INFO');
  });

  it('ignores a fixed trusted origin', () => {
    const recon = hardenedRecon({
      corsProbe: exchange('https://app.example.com/', 200, { 'access-control-allow-origin': 'https://app.example.com' }),
    });
    expect(corsCheck.run(recon)).toEqual([]);
  });
});

describe('serverDisclosureCheck', () => {
  it('flags versioned Server and X-Powered-By headers', () => {
    const recon = hardenedRecon({
      baseline: exchange('https://app.example.com/', 200, { server: 'Apache/2.4.49 (Unix)', 'x-powered-by': 'Express' }),
    });
    expect(ruleIds(serverDisclosureCheck.run(recon))).toEqual(['disclosure.server-version', 'disclosure.x-powered-by']);
  });

  it('ignores a Server header without a version', () => {
    expect(serverDisclosureCheck.run(hardenedRecon())).toEqual([]);
  });
});

describe('httpMethodsCheck', () => {
  it('flags advertised TRACE and write methods', () => {
    const recon = hardenedRecon({
      options: exchange('https://app.example.com/', 200, { allow: 'GET, POST, PUT, DELETE, TRACE' }, '', 'OPTIONS'),
    });
    expect(ruleIds(httpMethodsCheck.run(recon))).toEqual(['methods.trace-enabled', 'methods.write-methods-advertised']);
  });
});

describe('errorDisclosureCheck', () => {
  it('detects a Node.js stack trace on the not-found probe', () => {
    const body = 'Error: boom\n    at handler (/srv/app/index.js:42:13)\n    at next (/srv/app/node_modules/x.js:1:1)';
    const recon = hardenedRecon({ notFound: exchange('https://app.example.com/missing', 500, {}, body) });
    const findings = errorDisclosureCheck.run(recon);
    expect(ruleIds(findings)).toEqual(['errors.verbose-error']);
    expect(findings[0]!.evidence[0]!.response.bodySnippet).toContain('index.js:42:13');
  });

  it('detects SQL error text', () => {
    const recon = hardenedRecon({ notFound: exchange('https://app.example.com/missing', 500, {}, 'SQLSTATE[42000]: Syntax error') });
    expect(errorDisclosureCheck.run(recon)[0]?.title).toContain('SQL error');
  });

  it('reports a bare 500 on an unknown path as low', () => {
    const recon = hardenedRecon({ notFound: exchange('https://app.example.com/missing', 500, {}, 'Internal Server Error') });
    const findings = errorDisclosureCheck.run(recon);
    expect(ruleIds(findings)).toEqual(['errors.server-error-on-missing-path']);
    expect(findings[0]!.severity).toBe('LOW');
  });
});

describe('rateLimitCheck', () => {
  it('reports missing rate limit headers as informational with low confidence', () => {
    const recon = hardenedRecon({ baseline: exchange('https://app.example.com/', 200) });
    const [finding] = rateLimitCheck.run(recon);
    expect(finding).toMatchObject({ severity: 'INFO', confidence: 'LOW' });
  });
});

describe('fingerprints', () => {
  it('are stable across runs and differ per cookie', () => {
    const recon = hardenedRecon({
      baseline: exchange('http://app.example.com/', 200, { 'set-cookie': ['a=1; SameSite=Lax', 'b=2; SameSite=Lax'] }),
    });
    const first = cookieCheck.run(recon).map((f) => f.fingerprint);
    const second = cookieCheck.run(recon).map((f) => f.fingerprint);
    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(2);
  });
});
