import { testDatabaseUrl } from './test-env';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl();
process.env.REDIS_URL ??= 'redis://localhost:6379';
process.env.WEB_ORIGIN = 'http://localhost:3000';
process.env.SWAGGER_ENABLED = 'true';
// The suite simulates many clients behind a trusted local proxy via X-Forwarded-For.
process.env.TRUST_PROXY = 'loopback';
