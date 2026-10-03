import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { APP_CONFIG, type AppConfig } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';

export const CSRF = { 'x-sentinellab-csrf': '1' };

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app, app.get<AppConfig>(APP_CONFIG));
  await app.init();
  return app;
}

let ipCounter = 1;
/** Each simulated user gets its own client IP so rate limits do not leak between tests. */
export function nextIp(): string {
  ipCounter += 1;
  return `198.51.100.${ipCounter % 250}`;
}

export interface TestUser {
  agent: TestAgent;
  id: string;
  email: string;
  ip: string;
}

export async function registerUser(app: INestApplication, label = 'user'): Promise<TestUser> {
  const agent = request.agent(app.getHttpServer());
  const ip = nextIp();
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const res = await agent
    .post('/api/auth/register')
    .set(CSRF)
    .set('x-forwarded-for', ip)
    .send({ email, name: label, password: 'correct horse battery staple' })
    .expect(201);
  return { agent, id: res.body.user.id, email, ip };
}

export function prisma(app: INestApplication): PrismaService {
  return app.get(PrismaService);
}

export async function waitFor<T>(fn: () => Promise<T>, done: (v: T) => boolean, timeoutMs = 15_000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = await fn();
    if (done(value)) return value;
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting; last value: ${JSON.stringify(value)}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}
