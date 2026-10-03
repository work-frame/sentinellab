import type { CheckModule, FindingDraft } from '../types';
import { evidenceFrom, header, makeFinding } from './util';

const MODULE = 'information-disclosure';
const VERSION = /\d+\.\d+/;
const TECH_HEADERS = ['x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-generator'];

/** Server and framework version banners in response headers. */
export const serverDisclosureCheck: CheckModule = {
  name: MODULE,
  description: 'Server, X-Powered-By and similar headers that reveal software and versions.',
  run(recon) {
    const ex = recon.baseline;
    const findings: FindingDraft[] = [];
    const references = ['https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/01-Information_Gathering/02-Fingerprint_Web_Server'];

    const server = header(ex, 'server');
    if (server && VERSION.test(server)) {
      findings.push(
        makeFinding(MODULE, {
          ruleId: 'disclosure.server-version',
          title: 'Server header reveals software version',
          type: 'Information Disclosure',
          severity: 'LOW',
          confidence: 'HIGH',
          description: `The Server header is "${server}", which includes a version number.`,
          impact: 'Version numbers let anyone match the server against public vulnerability lists without further probing.',
          remediation: 'Configure the web server or proxy to send a generic Server value, or none.',
          references,
          evidence: [evidenceFrom(ex, `server: ${server}`)],
          exchange: ex,
        }),
      );
    }

    for (const name of TECH_HEADERS) {
      const value = header(ex, name);
      if (!value) continue;
      findings.push(
        makeFinding(MODULE, {
          ruleId: `disclosure.${name}`,
          title: `${name} header reveals the technology stack`,
          type: 'Information Disclosure',
          severity: 'LOW',
          confidence: 'HIGH',
          description: `The response includes "${name}: ${value}".`,
          impact: 'The header tells anyone which framework and often which version runs the application.',
          remediation: name === 'x-powered-by' ? 'Remove the header. In Express: app.disable("x-powered-by").' : 'Remove the header in the framework or proxy configuration.',
          references,
          evidence: [evidenceFrom(ex, `${name}: ${value}`)],
          exchange: ex,
          discriminator: name,
        }),
      );
    }
    return findings;
  },
};
