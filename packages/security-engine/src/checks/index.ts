import type { CheckModule } from '../types';
import { cookieCheck } from './cookies';
import { corsCheck } from './cors';
import { errorDisclosureCheck } from './error-disclosure';
import { httpMethodsCheck } from './http-methods';
import { rateLimitCheck } from './rate-limit';
import { securityHeadersCheck } from './security-headers';
import { serverDisclosureCheck } from './server-disclosure';
import { transportCheck } from './transport';

/** Every check, in the order they run. */
export const ALL_CHECKS: CheckModule[] = [
  securityHeadersCheck,
  cookieCheck,
  transportCheck,
  corsCheck,
  serverDisclosureCheck,
  httpMethodsCheck,
  errorDisclosureCheck,
  rateLimitCheck,
];

export {
  cookieCheck,
  corsCheck,
  errorDisclosureCheck,
  httpMethodsCheck,
  rateLimitCheck,
  securityHeadersCheck,
  serverDisclosureCheck,
  transportCheck,
};
