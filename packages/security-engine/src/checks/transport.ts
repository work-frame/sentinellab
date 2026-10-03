import type { CheckModule } from '../types';
import { evidenceFrom, makeFinding } from './util';

const MODULE = 'transport';

/** Flags targets that end up being served over plain HTTP. */
export const transportCheck: CheckModule = {
  name: MODULE,
  description: 'Targets served over plain HTTP without a redirect to HTTPS.',
  run(recon) {
    const ex = recon.baseline;
    if (!ex.request.url.startsWith('http:')) return [];
    const redirectedToHttps = recon.redirects.some((r) =>
      (r.response.headers['location']?.[0] ?? '').toLowerCase().startsWith('https:'),
    );
    if (redirectedToHttps) return [];
    return [
      makeFinding(MODULE, {
        ruleId: 'transport.no-https',
        title: 'Application is served over plain HTTP',
        type: 'Transport Security',
        severity: 'MEDIUM',
        confidence: 'HIGH',
        description: 'The base URL answers over HTTP and does not redirect to HTTPS.',
        impact: 'Anyone on the network path can read and change traffic, including passwords and session cookies.',
        remediation:
          'Serve the application over HTTPS, redirect every HTTP request to HTTPS with a 301, then add Strict-Transport-Security. For a local demo target this is expected, but production must not run like this.',
        references: ['https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html'],
        evidence: [evidenceFrom(ex, `GET ${ex.request.url} returned ${ex.response.status} over HTTP with no redirect to HTTPS.`)],
        exchange: ex,
      }),
    ];
  },
};
