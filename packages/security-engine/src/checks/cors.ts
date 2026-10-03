import type { CheckModule, FindingDraft } from '../types';
import { evidenceFrom, header, makeFinding } from './util';

const MODULE = 'cors';
const TYPE = 'CORS Misconfiguration';

/**
 * Reads the response to one GET request that carried an Origin header for a
 * domain SentinelLab controls (*.invalid, which can never resolve).
 */
export const corsCheck: CheckModule = {
  name: MODULE,
  description: 'Access-Control-Allow-Origin that reflects arbitrary origins or uses a wildcard.',
  run(recon) {
    const ex = recon.corsProbe;
    if (!ex) return [];
    const allowOrigin = header(ex, 'access-control-allow-origin');
    const allowCredentials = (header(ex, 'access-control-allow-credentials') ?? '').toLowerCase() === 'true';
    if (!allowOrigin) return [];
    const findings: FindingDraft[] = [];
    const references = [
      'https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS',
      'https://portswigger.net/web-security/cors',
    ];

    if (allowOrigin === recon.corsProbeOrigin) {
      findings.push(
        makeFinding(MODULE, {
          ruleId: allowCredentials ? 'cors.reflected-origin-credentials' : 'cors.reflected-origin',
          title: allowCredentials
            ? 'CORS reflects any origin and allows credentials'
            : 'CORS reflects any origin',
          type: TYPE,
          severity: allowCredentials ? 'HIGH' : 'MEDIUM',
          confidence: 'HIGH',
          description: `The server echoed the untrusted Origin "${recon.corsProbeOrigin}" back in Access-Control-Allow-Origin${allowCredentials ? ' and set Access-Control-Allow-Credentials: true' : ''}.`,
          impact: allowCredentials
            ? "Any website a signed-in user visits can make requests with the user's cookies and read the responses, including private data."
            : 'Any website can read responses from this endpoint from a visitor\'s browser. This matters when responses depend on the visitor\'s network or contain non-public data.',
          remediation: 'Compare the Origin header against a fixed allowlist of trusted origins. Never echo the request Origin back unchecked.',
          references,
          evidence: [evidenceFrom(ex, `Sent Origin: ${recon.corsProbeOrigin}; received Access-Control-Allow-Origin: ${allowOrigin}, Access-Control-Allow-Credentials: ${allowCredentials}.`)],
          exchange: ex,
        }),
      );
    } else if (allowOrigin === '*') {
      findings.push(
        makeFinding(MODULE, {
          ruleId: allowCredentials ? 'cors.wildcard-credentials' : 'cors.wildcard',
          title: allowCredentials ? 'CORS wildcard combined with credentials' : 'CORS allows any origin (wildcard)',
          type: TYPE,
          severity: allowCredentials ? 'MEDIUM' : 'INFO',
          confidence: allowCredentials ? 'HIGH' : 'MEDIUM',
          description: allowCredentials
            ? 'The server sends Access-Control-Allow-Origin: * together with Access-Control-Allow-Credentials: true. Browsers refuse this combination, which suggests the CORS policy was set without a clear design.'
            : 'The server sends Access-Control-Allow-Origin: *. This is fine for truly public data and a problem for anything else.',
          impact: 'Any website can read responses from this endpoint from a visitor\'s browser (without cookies).',
          remediation: 'Use a wildcard only for public, unauthenticated data. Otherwise list the trusted origins explicitly.',
          references,
          evidence: [evidenceFrom(ex, `Access-Control-Allow-Origin: *, Access-Control-Allow-Credentials: ${allowCredentials}.`)],
          exchange: ex,
        }),
      );
    }
    return findings;
  },
};
