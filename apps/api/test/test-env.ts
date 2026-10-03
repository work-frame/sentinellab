import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Resolve the test database URL. It always points at a database whose name
 * ends in "_test", so the integration suite can never reset a real database.
 */
export function testDatabaseUrl(): string {
  const rootEnv = resolve(__dirname, '../../../.env');
  if (existsSync(rootEnv) && !process.env.DATABASE_URL) process.loadEnvFile(rootEnv);
  const raw = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!raw) throw new Error('Set TEST_DATABASE_URL or DATABASE_URL to run integration tests');
  const url = new URL(raw);
  const db = url.pathname.replace(/^\//, '');
  if (!db.endsWith('_test')) url.pathname = `/${db}_test`;
  return url.toString();
}
