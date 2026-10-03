import { INestApplication } from '@nestjs/common';
import { createApp, CSRF, registerUser, type TestUser } from './helpers';

const PUBLIC_URL = 'http://93.184.215.14/';

describe('targets', () => {
  let app: INestApplication;
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    app = await createApp();
    alice = await registerUser(app, 'alice');
    bob = await registerUser(app, 'bob');
  });
  afterAll(() => app.close());

  function createTarget(user: TestUser, body: Record<string, unknown> = {}) {
    return user.agent
      .post('/api/targets')
      .set(CSRF)
      .send({ name: 'Public site', baseUrl: PUBLIC_URL, environment: 'STAGING', ...body });
  }

  it('creates, reads, updates and deletes a target', async () => {
    const created = await createTarget(alice, { authorizationConfirmed: true, authorizationNote: 'Owner: me' }).expect(201);
    const id = created.body.id;
    expect(created.body.authorizationConfirmedAt).not.toBeNull();

    const listed = await alice.agent.get('/api/targets?q=public').expect(200);
    expect(listed.body.items.map((t: { id: string }) => t.id)).toContain(id);

    await alice.agent.patch(`/api/targets/${id}`).set(CSRF).send({ name: 'Renamed', enabled: false }).expect(200);
    const got = await alice.agent.get(`/api/targets/${id}`).expect(200);
    expect(got.body).toMatchObject({ name: 'Renamed', enabled: false });

    await alice.agent.delete(`/api/targets/${id}`).set(CSRF).expect(204);
    await alice.agent.get(`/api/targets/${id}`).expect(404);
  });

  it.each([
    ['loopback', 'http://127.0.0.1:5432/'],
    ['localhost name', 'http://localhost:6379/'],
    ['cloud metadata', 'http://169.254.169.254/latest/meta-data/'],
    ['private network', 'http://10.0.0.8/'],
    ['IPv6 loopback', 'http://[::1]/'],
    ['decimal loopback', 'http://2130706433/'],
    ['file scheme', 'file:///etc/passwd'],
    ['embedded credentials', 'http://user:pass@93.184.215.14/'],
  ])('refuses an SSRF-prone URL (%s)', async (_label, baseUrl) => {
    const res = await createTarget(alice, { baseUrl }).expect(400);
    expect(String(res.body.message)).not.toMatch(/at .*\.ts/);
  });

  it('rejects mass-assignment of protected fields', async () => {
    await createTarget(alice, { ownerId: bob.id }).expect(400);
    await createTarget(alice, { isDemo: true }).expect(400);
    await createTarget(alice, { environment: 'LOCAL_DEMO' }).expect(400);
  });

  it('hides other users targets (IDOR)', async () => {
    const { body } = await createTarget(alice, { authorizationConfirmed: true }).expect(201);
    await bob.agent.get(`/api/targets/${body.id}`).expect(404);
    await bob.agent.patch(`/api/targets/${body.id}`).set(CSRF).send({ name: 'pwned' }).expect(404);
    await bob.agent.delete(`/api/targets/${body.id}`).set(CSRF).expect(404);
    await bob.agent.post(`/api/targets/${body.id}/scans`).set(CSRF).expect(404);
    await bob.agent.post(`/api/targets/${body.id}/authorize`).set(CSRF).send({ confirm: true }).expect(404);
    const list = await bob.agent.get('/api/targets').expect(200);
    expect(list.body.items.find((t: { id: string }) => t.id === body.id)).toBeUndefined();
    const still = await alice.agent.get(`/api/targets/${body.id}`).expect(200);
    expect(still.body.name).toBe('Public site');
  });

  it('requires authorization before scanning and clears it when the URL changes', async () => {
    const { body } = await createTarget(alice).expect(201);
    const refused = await alice.agent.post(`/api/targets/${body.id}/scans`).set(CSRF).expect(400);
    expect(refused.body.message).toMatch(/authorized/);

    await alice.agent.post(`/api/targets/${body.id}/authorize`).set(CSRF).send({ confirm: false }).expect(400);
    await alice.agent.post(`/api/targets/${body.id}/authorize`).set(CSRF).send({ confirm: true }).expect(200);

    const updated = await alice.agent.patch(`/api/targets/${body.id}`).set(CSRF).send({ baseUrl: 'http://93.184.215.15/' }).expect(200);
    expect(updated.body.authorizationConfirmedAt).toBeNull();
  });

  it('refuses to scan a disabled target', async () => {
    const { body } = await createTarget(alice, { authorizationConfirmed: true }).expect(201);
    await alice.agent.patch(`/api/targets/${body.id}`).set(CSRF).send({ enabled: false }).expect(200);
    await alice.agent.post(`/api/targets/${body.id}/scans`).set(CSRF).expect(400);
  });

  it('rejects malformed ids', async () => {
    await alice.agent.get("/api/targets/1' OR '1'='1").expect(400);
  });
});
