import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, CSRF, nextIp, prisma, registerUser } from './helpers';

describe('authentication', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createApp();
  });
  afterAll(() => app.close());

  it('registers a user, sets a hardened session cookie and never returns the hash', async () => {
    const ip = nextIp();
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .set(CSRF)
      .set('x-forwarded-for', ip)
      .send({ email: `New-${Date.now()}@Example.com`, name: 'New', password: 'a sufficiently long passphrase' })
      .expect(201);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/sl_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|argon2/);
    expect(res.body.user.email).toMatch(/^new-\d+@example\.com$/);
  });

  it('stores an argon2id hash, not the password', async () => {
    const user = await registerUser(app);
    const row = await prisma(app).user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
    expect(row.passwordHash).not.toContain('correct horse');
  });

  it('rejects short passwords and unknown fields', async () => {
    const agent = request(app.getHttpServer());
    await agent.post('/api/auth/register').set(CSRF).set('x-forwarded-for', nextIp()).send({ email: 'x@example.com', name: 'x', password: 'short' }).expect(400);
    await agent
      .post('/api/auth/register')
      .set(CSRF)
      .set('x-forwarded-for', nextIp())
      .send({ email: `r-${Date.now()}@example.com`, name: 'x', password: 'long enough password', role: 'ADMIN' })
      .expect(400);
  });

  it('returns the same error for a wrong password and an unknown email', async () => {
    const user = await registerUser(app);
    const agent = request(app.getHttpServer());
    const wrong = await agent.post('/api/auth/login').set(CSRF).set('x-forwarded-for', nextIp()).send({ email: user.email, password: 'wrong password!!' }).expect(401);
    const unknown = await agent.post('/api/auth/login').set(CSRF).set('x-forwarded-for', nextIp()).send({ email: 'nobody@example.com', password: 'wrong password!!' }).expect(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('logs in, serves /me, and logs out so the old cookie stops working', async () => {
    const user = await registerUser(app);
    const me = await user.agent.get('/api/auth/me').expect(200);
    expect(me.body.email).toBe(user.email);
    await user.agent.post('/api/auth/logout').set(CSRF).expect(204);
    await user.agent.get('/api/auth/me').expect(401);
    await user.agent.post('/api/auth/login').set(CSRF).set('x-forwarded-for', user.ip).send({ email: user.email, password: 'correct horse battery staple' }).expect(200);
    await user.agent.get('/api/auth/me').expect(200);
  });

  it('rejects requests without a session or with a forged token', async () => {
    await request(app.getHttpServer()).get('/api/targets').expect(401);
    await request(app.getHttpServer()).get('/api/targets').set('Cookie', 'sl_session=forged-token-value-that-is-long-enough').expect(401);
  });

  it('requires the CSRF header and a trusted Origin on state-changing requests', async () => {
    const user = await registerUser(app);
    await user.agent.post('/api/targets').send({}).expect(403);
    await user.agent.post('/api/targets').set(CSRF).set('Origin', 'https://evil.example').send({}).expect(403);
    await user.agent.post('/api/auth/logout').set(CSRF).set('Origin', 'http://localhost:3000').expect(204);
  });

  it('rate limits login attempts per IP', async () => {
    const ip = nextIp();
    const agent = request(app.getHttpServer());
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await agent.post('/api/auth/login').set(CSRF).set('x-forwarded-for', ip).send({ email: 'nobody@example.com', password: 'nope nope nope' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });

  it('locks an account after 10 failed passwords, even from different IPs', async () => {
    const user = await registerUser(app);
    const agent = request(app.getHttpServer());
    for (let i = 0; i < 10; i++) {
      await agent.post('/api/auth/login').set(CSRF).set('x-forwarded-for', nextIp()).send({ email: user.email, password: 'wrong password!!' }).expect(401);
    }
    await agent.post('/api/auth/login').set(CSRF).set('x-forwarded-for', nextIp()).send({ email: user.email, password: 'correct horse battery staple' }).expect(401);
  });

  it('writes audit entries without passwords', async () => {
    const user = await registerUser(app);
    await request(app.getHttpServer()).post('/api/auth/login').set(CSRF).set('x-forwarded-for', nextIp()).send({ email: user.email, password: 'correct horse battery staple' }).expect(200);
    const logs = await prisma(app).auditLog.findMany({ where: { actorId: user.id } });
    expect(logs.map((l) => l.action)).toEqual(expect.arrayContaining(['auth.register', 'auth.login']));
    expect(JSON.stringify(logs)).not.toContain('correct horse');
  });

  it('sends security headers and hides framework details', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('returns a generic body for malformed JSON', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set(CSRF)
      .set('x-forwarded-for', nextIp())
      .set('content-type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/at \w+ \(|node_modules/);
  });

  it('serves the OpenAPI document', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs/openapi.json').expect(200);
    expect(Object.keys(res.body.paths)).toEqual(expect.arrayContaining(['/api/auth/login', '/api/targets', '/api/scans', '/api/findings', '/api/reports', '/api/dashboard']));
  });
});
