import type { CheckModule } from '../types';
import { evidenceFrom, header, makeFinding } from './util';

const MODULE = 'rate-limiting';
const RATE_HEADERS = ['ratelimit', 'ratelimit-policy', 'ratelimit-limit', 'x-ratelimit-limit', 'x-rate-limit-limit', 'retry-after'];

/**
 * Looks for rate limit headers only. SentinelLab does not send request bursts
 * in this version, so a missing header is reported as informational with low
 * confidence: the server may still enforce limits without advertising them.
 */
export const rateLimitCheck: CheckModule = {
  name: MODULE,
  description: 'Absence of rate limit headers (informational; no burst testing).',
  run(recon) {
    const ex = recon.baseline;
    if (RATE_HEADERS.some((h) => header(ex, h))) return [];
    return [
      makeFinding(MODULE, {
        ruleId: 'ratelimit.no-headers',
        title: 'No rate limiting signals observed',
        type: 'API Security',
        severity: 'INFO',
        confidence: 'LOW',
        description: 'The response carries no RateLimit, X-RateLimit or Retry-After headers. SentinelLab did not send bursts of requests, so this does not prove that rate limiting is missing.',
        impact: 'Without rate limits, login forms and APIs are open to password guessing, scraping and resource exhaustion.',
        remediation: 'Apply rate limits, at least on authentication and expensive endpoints, and advertise them with the RateLimit headers so clients can back off.',
        references: [
          'https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/',
          'https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/',
        ],
        evidence: [evidenceFrom(ex, 'No rate limit headers in the baseline response.')],
        exchange: ex,
      }),
    ];
  },
};
