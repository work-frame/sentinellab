import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { testDatabaseUrl } from './test-env';

/**
 * Bring the test database up to the latest migration. `migrate deploy` only
 * applies pending migrations and never drops data. Tests create their own
 * uniquely named users, so rows left from earlier runs do not affect results.
 */
export default function globalSetup() {
  const url = testDatabaseUrl();
  if (!new URL(url).pathname.endsWith('_test')) throw new Error('Refusing to migrate a non-test database');
  execFileSync(process.execPath, [resolve(__dirname, '../node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
}
