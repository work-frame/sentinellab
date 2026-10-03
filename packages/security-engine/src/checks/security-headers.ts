import type { CheckModule, FindingDraft } from '../types';
import { evidenceFrom, header, isHtml, isHttps, makeFinding } from './util';

const MODULE = 'security-headers';
const TYPE = 'Security Misconfiguration';

/** Checks the baseline response for missing browser security headers. */
export const securityHeadersCheck: CheckModule = {
  name: MODULE,
  description: 'Missing Content-Security-Policy, HSTS, X-Content-Type-Options, clickjacking and Referrer-Policy headers.',
  run(recon) {
    const ex = recon.baseline;
    const findings: FindingDraft[] = [];
    const html = isHtml(ex);
    const csp = header(ex, 'content-security-policy');

    if (html && !csp) {
      findings.push(
        makeFinding(MODULE, {
          ruleId: 'headers.csp-missing',
          title: 'Content-Security-Policy header is missing',
          type: TYPE,
          severity: 'MEDIUM',
          confidence: 'HIGH',
          description: 'The HTML response does not set a Content-Security-Policy header.',
          impact:
            'Without a CSP the browser runs any script that ends up in the page. If an XSS bug exists, nothing limits what the injected script can load or send.',
          remediation:
            "Send a Content-Security-Policy header. Start with \"default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'\" and add the sources your pages need.",
          references: [
            'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP',
            'https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html',
          ],
          evidence: [evidenceFrom(ex, 'No content-security-policy header in the response.')],
          exchange: ex,
        }),
      );
    }

    if (html && !header(ex, 'x-frame-options') && !/frame-ancestors/i.test(csp ?? '')) {
      findings.push(
        makeFinding(MODULE, {
          ruleId: 'headers.clickjacking',
          title: 'Page can be framed by other sites (no clickjacking protection)',
          type: TYPE,
          severity: 'MEDIUM',
          confidence: 'HIGH',
          description: 'Neither X-Frame-Options nor a CSP frame-ancestors directive is set on an HTML response.',
          impact:
            'Another site can load this page in an invisible frame and trick a signed-in user into clicking buttons they cannot see.',
          remediation: "Add \"Content-Security-Policy: frame-ancestors 'none'\" (or 'self'), and X-Frame-Options: DENY for older browsers.",
          references: ['https://cheatsheetseries.owasp.org/cheatsheets/Clickjacking_Defense_Cheat_Sheet.html'],
          evidence: [evidenceFrom(ex, 'No x-frame-options header and no frame-ancestors directive.')],
          exchange: ex,
        }),
      );
    }

    if ((header(ex, 'x-content-type-options') ?? '').toLowerCase() !== 'nosniff') {
      findings.push(
        makeFinding(MODULE, {
          ruleId: 'headers.nosniff-missing',
          title: 'X-Content-Type-Options: nosniff is missing',
          type: TYPE,
          severity: 'LOW',
          confidence: 'HIGH',
          description: 'The response does not set X-Content-Type-Options to nosniff.',
          impact: 'Browsers may guess the content type of a response and treat uploaded or user-controlled text as script or HTML.',
          remediation: 'Send "X-Content-Type-Options: nosniff" on every response.',
          references: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options'],
          evidence: [evidenceFrom(ex, `x-content-type-options is ${JSON.stringify(header(ex, 'x-content-type-options') ?? null)}.`)],
          exchange: ex,
        }),
      );
    }

    if (isHttps(ex) && !header(ex, 'strict-transport-security')) {
      findings.push(
        makeFinding(MODULE, {
          ruleId: 'headers.hsts-missing',
          title: 'Strict-Transport-Security header is missing',
          type: 'Transport Security',
          severity: 'MEDIUM',
          confidence: 'HIGH',
          description: 'The HTTPS response does not set a Strict-Transport-Security header.',
          impact: 'A user who types the address or follows an http:// link can be downgraded to plain HTTP by someone on the same network.',
          remediation: 'Send "Strict-Transport-Security: max-age=31536000; includeSubDomains" once every subdomain serves HTTPS.',
          references: ['https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html'],
          evidence: [evidenceFrom(ex, 'No strict-transport-security header on an HTTPS response.')],
          exchange: ex,
        }),
      );
    }

    if (html && !header(ex, 'referrer-policy')) {
      findings.push(
        makeFinding(MODULE, {
          ruleId: 'headers.referrer-policy-missing',
          title: 'Referrer-Policy header is missing',
          type: TYPE,
          severity: 'LOW',
          confidence: 'HIGH',
          description: 'The HTML response does not set a Referrer-Policy header.',
          impact: 'Full URLs, including any tokens or IDs in query strings, can leak to third-party sites through the Referer header.',
          remediation: 'Send "Referrer-Policy: strict-origin-when-cross-origin" or a stricter value.',
          references: ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy'],
          evidence: [evidenceFrom(ex, 'No referrer-policy header in the response.')],
          exchange: ex,
        }),
      );
    }

    return findings;
  },
};
