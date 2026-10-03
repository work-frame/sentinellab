import { INestApplication } from '@nestjs/common';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp, CSRF, prisma, registerUser, waitFor, type TestUser } from './helpers';

/** Local misconfigured server; the test adds its exact host:port to the allowlist. */
function startTarget(delayMs = 0): Promise<{ server: Server; url: string }> {
  const server = createServer((req, res) => {
    setTimeout(() => {
      res.setHeader('server', 'DemoServer/1.0.3');
      res.setHeader('x-powered-by', 'Express');
      if (req.headers.origin) {
        res.setHeader('access-control-allow-origin', req.headers.origin);
        res.setHeader('access-control-allow-credentials', 'true');
      }
      if (req.url !== '/') {
        res.writeHead(500, { 'content-type': 'text/plain' });
        return res.end('TypeError: x is undefined\n    at route (/srv/demo/app.js:12:7)');
      }
      res.writeHead(200, { 'content-type': 'text/html', 'set-cookie': 'session=super-secret-session-value; Path=/' });
      res.end('<html><body>demo</body></html>');
    }, delayMs);
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/` })),
  );
}

describe('scans, findings, reports and dashboard', () => {
  let app: INestApplication;
  let target: Awaited<ReturnType<typeof startTarget>>;
  let slowTarget: Awaited<ReturnType<typeof startTarget>>;
  let downUrl: string;
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    target = await startTarget();
    slowTarget = await startTarget(1500);
    // Reserve a port, then close the server so nothing listens there.
    const down = await startTarget();
    downUrl = down.url;
    await new Promise<void>((r) => down.server.close(() => r()));
    const hp = (u: string) => new URL(u).host;
    process.env.SCANNER_PRIVATE_ALLOWLIST = [target.url, slowTarget.url, downUrl].map(hp).join(',');
    app = await createApp();
    alice = await registerUser(app, 'alice');
    bob = await registerUser(app, 'bob');
  });

  afterAll(async () => {
    await app.close();
    target.server.close();
    slowTarget.server.close();
    delete process.env.SCANNER_PRIVATE_ALLOWLIST;
  });

  async function authorizedTarget(url: string) {
    const res = await alice.agent
      .post('/api/targets')
      .set(CSRF)
      .send({ name: 'Local test server', baseUrl: url, environment: 'DEVELOPMENT', authorizationConfirmed: true })
      .expect(201);
    return res.body.id as string;
  }

  it('runs a full scan in the background and stores redacted findings', async () => {
    const targetId = await authorizedTarget(target.url);
    const started = await alice.agent.post(`/api/targets/${targetId}/scans`).set(CSRF).expect(202);
    expect(started.body.status).toBe('QUEUED');

    const scan = await waitFor(
      () => alice.agent.get(`/api/scans/${started.body.id}`).then((r) => r.body),
      (s) => ['COMPLETED', 'FAILED'].includes(s.status),
    );
    expect(scan.status).toBe('COMPLETED');
    expect(scan.progress).toBe(100);
    expect(scan.modules.every((m: { status: string }) => m.status === 'COMPLETED')).toBe(true);
    expect(scan.findingsBySeverity.HIGH).toBeGreaterThanOrEqual(1);

    const findings = await alice.agent.get(`/api/findings?scanId=${scan.id}&pageSize=100`).expect(200);
    const titles = findings.body.items.map((f: { title: string }) => f.title).join('\n');
    expect(titles).toMatch(/CORS reflects any origin and allows credentials/);
    expect(titles).toMatch(/stack trace/);
    expect(findings.body.items[0].severity).toBe('HIGH');

    const cookieFinding = findings.body.items.find((f: { title: string }) => f.title.includes('HttpOnly'));
    const detail = await alice.agent.get(`/api/findings/${cookieFinding.id}`).expect(200);
    expect(detail.body.evidence.length).toBeGreaterThan(0);
    expect(JSON.stringify(detail.body)).not.toContain('super-secret-session-value');
  });

  it('prevents a second scan while one is active, and cancels a queued or running scan', async () => {
    const targetId = await authorizedTarget(slowTarget.url);
    const first = await alice.agent.post(`/api/targets/${targetId}/scans`).set(CSRF).expect(202);
    await alice.agent.post(`/api/targets/${targetId}/scans`).set(CSRF).expect(409);
    await alice.agent.post(`/api/scans/${first.body.id}/cancel`).set(CSRF).expect(200);
    const scan = await waitFor(
      () => alice.agent.get(`/api/scans/${first.body.id}`).then((r) => r.body),
      (s) => !['QUEUED', 'RUNNING'].includes(s.status),
    );
    expect(scan.status).toBe('CANCELLED');
    await alice.agent.post(`/api/scans/${first.body.id}/cancel`).set(CSRF).expect(409);
  });

  it('records a failed scan with a safe message when the target is down', async () => {
    const targetId = await authorizedTarget(downUrl);
    const started = await alice.agent.post(`/api/targets/${targetId}/scans`).set(CSRF).expect(202);
    const scan = await waitFor(
      () => alice.agent.get(`/api/scans/${started.body.id}`).then((r) => r.body),
      (x) => !['QUEUED', 'RUNNING'].includes(x.status),
    );
    expect(scan.status).toBe('FAILED');
    expect(scan.error).toBe('Connection refused. Is the target running?');
    expect(scan.modules.find((m: { name: string }) => m.name === 'recon').status).toBe('FAILED');
  });

  it('changes finding status, keeps false positives on re-scan, and audits it', async () => {
    const targetId = await authorizedTarget(target.url);
    const s1 = await alice.agent.post(`/api/targets/${targetId}/scans`).set(CSRF).expect(202);
    await waitFor(() => alice.agent.get(`/api/scans/${s1.body.id}`).then((r) => r.body.status), (st) => st === 'COMPLETED');
    const list = await alice.agent.get(`/api/findings?scanId=${s1.body.id}&q=Server header`).expect(200);
    const finding = list.body.items[0];

    await alice.agent.patch(`/api/findings/${finding.id}/status`).set(CSRF).send({ status: 'NOT_A_STATUS' }).expect(400);
    await alice.agent.patch(`/api/findings/${finding.id}/status`).set(CSRF).send({ status: 'FALSE_POSITIVE', note: 'Banner is fake' }).expect(200);
    await bob.agent.patch(`/api/findings/${finding.id}/status`).set(CSRF).send({ status: 'RESOLVED' }).expect(404);

    const s2 = await alice.agent.post(`/api/targets/${targetId}/scans`).set(CSRF).expect(202);
    await waitFor(() => alice.agent.get(`/api/scans/${s2.body.id}`).then((r) => r.body.status), (st) => st === 'COMPLETED');
    const again = await alice.agent.get(`/api/findings?scanId=${s2.body.id}&q=Server header`).expect(200);
    expect(again.body.items[0].status).toBe('FALSE_POSITIVE');

    const audit = await prisma(app).auditLog.findMany({ where: { actorId: alice.id, action: 'finding.status_changed' } });
    expect(audit[0]?.metadata).toMatchObject({ from: 'OPEN', to: 'FALSE_POSITIVE' });
  });

  it('generates and downloads reports in both formats', async () => {
    const scans = await alice.agent.get('/api/scans?status=COMPLETED').expect(200);
    const scanId = scans.body.items[0].id;

    const md = await alice.agent.post(`/api/scans/${scanId}/reports`).set(CSRF).send({ format: 'MARKDOWN' }).expect(201);
    const mdFile = await alice.agent.get(`/api/reports/${md.body.id}/download`).expect(200);
    expect(mdFile.headers['content-disposition']).toMatch(/attachment; filename="sentinellab-report-.*\.md"/);
    expect(mdFile.text).toContain('## 9. Conclusion');
    expect(mdFile.text).toContain('does not prove that the application is secure');
    expect(mdFile.text).not.toContain('super-secret-session-value');

    const html = await alice.agent.post(`/api/scans/${scanId}/reports`).set(CSRF).send({ format: 'HTML' }).expect(201);
    const htmlFile = await alice.agent.get(`/api/reports/${html.body.id}/download`).buffer(true).parse((res, cb) => {
      let data = '';
      res.on('data', (c: Buffer) => (data += c.toString()));
      res.on('end', () => cb(null, data));
    }).expect(200);
    expect(htmlFile.headers['content-security-policy']).toContain("default-src 'none'");
    expect(String(htmlFile.body)).toContain('<h2>6. Severity breakdown</h2>');

    await bob.agent.get(`/api/reports/${md.body.id}/download`).expect(404);
    await bob.agent.post(`/api/scans/${scanId}/reports`).set(CSRF).send({ format: 'HTML' }).expect(404);
    const bobReports = await bob.agent.get('/api/reports').expect(200);
    expect(bobReports.body.total).toBe(0);
  });

  it('builds the dashboard only from the users own data', async () => {
    const a = await alice.agent.get('/api/dashboard').expect(200);
    expect(a.body.scans.completed).toBeGreaterThanOrEqual(3);
    expect(a.body.findings.open).toBeGreaterThan(0);
    expect(a.body.recentFindings.length).toBeGreaterThan(0);

    const b = await bob.agent.get('/api/dashboard').expect(200);
    expect(b.body).toMatchObject({ scans: { total: 0, completed: 0, active: 0 }, findings: { total: 0, open: 0 }, recentFindings: [], targetHealth: [] });
    await bob.agent.get(`/api/scans/${a.body.recentScans[0].id}`).expect(404);
    await bob.agent.get(`/api/findings/${a.body.recentFindings[0].id}`).expect(404);
  });
});
