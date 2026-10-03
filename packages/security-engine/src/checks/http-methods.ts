import type { CheckModule, FindingDraft } from '../types';
import { evidenceFrom, header, makeFinding } from './util';

const MODULE = 'http-methods';

function parseMethods(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((m) => m.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Reads the Allow header from one OPTIONS request. SentinelLab never sends
 * TRACE, PUT or DELETE itself; it only reports what the server advertises.
 */
export const httpMethodsCheck: CheckModule = {
  name: MODULE,
  description: 'TRACE/TRACK and write methods advertised by the server in response to OPTIONS.',
  run(recon) {
    const ex = recon.options;
    if (!ex) return [];
    const allowed = parseMethods(header(ex, 'allow') ?? header(ex, 'access-control-allow-methods'));
    const findings: FindingDraft[] = [];

    const trace = allowed.filter((m) => m === 'TRACE' || m === 'TRACK');
    if (trace.length > 0) {
      findings.push(
        makeFinding(MODULE, {
          ruleId: 'methods.trace-enabled',
          title: 'TRACE method is advertised',
          type: 'Security Misconfiguration',
          severity: 'LOW',
          confidence: 'MEDIUM',
          description: `OPTIONS lists ${trace.join(' and ')} as allowed methods.`,
          impact: 'TRACE echoes the request back, which can expose headers added by proxies. Modern browsers block it, so the risk is mostly information leakage.',
          remediation: 'Disable TRACE and TRACK in the web server or proxy.',
          references: ['https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/06-Test_HTTP_Methods'],
          evidence: [evidenceFrom(ex, `Allowed methods: ${allowed.join(', ')}`)],
          exchange: ex,
        }),
      );
    }

    const write = allowed.filter((m) => m === 'PUT' || m === 'DELETE' || m === 'PATCH');
    if (write.length > 0) {
      findings.push(
        makeFinding(MODULE, {
          ruleId: 'methods.write-methods-advertised',
          title: 'Write methods advertised on the base path',
          type: 'Security Misconfiguration',
          severity: 'INFO',
          confidence: 'LOW',
          description: `OPTIONS on the base URL lists ${write.join(', ')}. SentinelLab did not send these methods.`,
          impact: 'If these methods work without authentication on this path, they could change or delete content. Often they are listed by default and rejected later.',
          remediation: 'Confirm the methods require authentication on every route, and stop advertising methods a route does not support.',
          references: ['https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/06-Test_HTTP_Methods'],
          evidence: [evidenceFrom(ex, `Allowed methods: ${allowed.join(', ')}`)],
          exchange: ex,
        }),
      );
    }
    return findings;
  },
};
