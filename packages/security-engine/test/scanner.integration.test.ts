import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { parsePolicy } from '../src/http/target-policy';
import { runScan, ScanCancelledError } from '../src/scanner';

/** A deliberately misconfigured local server, reachable only on 127.0.0.1. */
function startServer(): Promise<{ server: Server; base: string; requests: string[] }> {
  const requests: string[] = [];
  const server = createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`);
    if (req.url === '/hop') {
      res.writeHead(302, { location: 'http://example.com/elsewhere' });
      return res.end();
    }
    res.setHeader('server', 'TestServer/1.2.3');
    res.setHeader('x-powered-by', 'Express');
    if (req.headers.origin) {
      res.setHeader('access-control-allow-origin', req.headers.origin);
      res.setHeader('access-control-allow-credentials', 'true');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { allow: 'GET, POST, PUT, DELETE, TRACE, OPTIONS' });
      return res.end();
    }
    if (req.url !== '/') {
      res.writeHead(500, { 'content-type': 'text/plain' });
      return res.end('Error: lookup failed\n    at handler (/srv/app/server.js:10:5)');
    }
    res.writeHead(200, { 'content-type': 'text/html', 'set-cookie': 'session=abc; Path=/' });
    res.end('<html><body>demo</body></html>');
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, base: `http://127.0.0.1:${port}/`, requests });
    }),
  );
}

describe('runScan against a local misconfigured server', () => {
  let ctx: Awaited<ReturnType<typeof startServer>>;
  beforeAll(async () => {
    ctx = await startServer();
  });
  afterAll(() => new Promise<void>((r) => ctx.server.close(() => r())));

  const policy = () => parsePolicy(`127.0.0.1:${new URL(ctx.base).port}`);

  it('finds the expected issues and only sends safe methods', async () => {
    const progress: string[] = [];
    const result = await runScan({ baseUrl: ctx.base, policy: policy(), onProgress: (e) => void progress.push(`${e.module}:${e.status}`) });
    const rules = result.findings.map((f) => f.ruleId);
    expect(rules).toEqual(
      expect.arrayContaining([
        'cors.reflected-origin-credentials',
        'headers.csp-missing',
        'cookies.httponly-missing',
        'transport.no-https',
        'disclosure.server-version',
        'methods.trace-enabled',
        'errors.verbose-error',
      ]),
    );
    expect(result.findings[0]!.severity).toBe('HIGH');
    expect(result.modules.every((m) => m.status === 'COMPLETED')).toBe(true);
    expect(progress[0]).toBe('recon:STARTED');
    expect(ctx.requests.every((r) => r.startsWith('GET ') || r.startsWith('OPTIONS '))).toBe(true);
  });

  it('refuses to scan the server when it is not allowlisted', async () => {
    await expect(runScan({ baseUrl: ctx.base, policy: parsePolicy('') })).rejects.toThrow(/not on the allowlist/);
  });

  it('does not follow a redirect to another host', async () => {
    const before = ctx.requests.length;
    const result = await runScan({ baseUrl: `${ctx.base}hop`, policy: policy() });
    expect(result.requestCount).toBeGreaterThan(0);
    expect(ctx.requests.slice(before)[0]).toBe('GET /hop');
  });

  it('stops when the signal is aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(runScan({ baseUrl: ctx.base, policy: policy(), signal: controller.signal })).rejects.toBeInstanceOf(ScanCancelledError);
  });
});
