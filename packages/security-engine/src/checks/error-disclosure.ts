import type { CheckModule, FindingDraft, HttpExchange } from '../types';
import { evidenceFrom, makeFinding } from './util';

const MODULE = 'error-handling';

/** Signatures of stack traces and database errors in response bodies. */
export const ERROR_SIGNATURES: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Node.js stack trace', pattern: /\n\s+at [^\n]+\((?:\/|[A-Za-z]:\\)[^\n]+:\d+:\d+\)/ },
  { label: 'Python traceback', pattern: /Traceback \(most recent call last\)/ },
  { label: 'Java exception', pattern: /\b(?:java|javax|org\.springframework)\.[\w.]+(?:Exception|Error)\b/ },
  { label: 'PHP error', pattern: /<b>(?:Fatal error|Warning|Parse error)<\/b>:.+ on line <b>\d+<\/b>/ },
  { label: '.NET exception', pattern: /System\.[\w.]+Exception|Server Error in '\/' Application/ },
  { label: 'SQL error', pattern: /SQLSTATE\[|ORA-\d{5}|PG::\w+Error|SQLITE_ERROR|You have an error in your SQL syntax/ },
  { label: 'Ruby on Rails error', pattern: /ActionController::|ActiveRecord::\w+/ },
];

function scan(ex: HttpExchange | undefined): { label: string; match: string } | null {
  if (!ex) return null;
  for (const sig of ERROR_SIGNATURES) {
    const m = ex.response.bodySnippet.match(sig.pattern);
    if (m) return { label: sig.label, match: m[0].trim().slice(0, 200) };
  }
  return null;
}

/** Looks for internal error details in the baseline and the not-found probe. */
export const errorDisclosureCheck: CheckModule = {
  name: MODULE,
  description: 'Stack traces and database errors returned to the client.',
  run(recon) {
    const findings: FindingDraft[] = [];
    for (const ex of [recon.baseline, recon.notFound]) {
      const hit = scan(ex);
      if (!ex || !hit) continue;
      findings.push(
        makeFinding(MODULE, {
          ruleId: 'errors.verbose-error',
          title: `Response contains a ${hit.label}`,
          type: 'Information Disclosure',
          severity: 'MEDIUM',
          confidence: 'HIGH',
          description: `The response to ${ex.request.method} ${ex.request.url} (status ${ex.response.status}) includes a ${hit.label}.`,
          impact: 'Stack traces and database errors reveal file paths, library versions, query structure and sometimes data. Attackers use these to plan further attacks.',
          remediation: 'Return a generic error message to clients and log the details on the server. Turn off debug mode in production.',
          references: ['https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html'],
          evidence: [evidenceFrom(ex, `Matched: ${hit.match}`, true)],
          exchange: ex,
        }),
      );
    }

    const nf = recon.notFound;
    if (nf && nf.response.status >= 500 && !scan(nf)) {
      findings.push(
        makeFinding(MODULE, {
          ruleId: 'errors.server-error-on-missing-path',
          title: 'Unknown path causes a server error',
          type: 'Error Handling',
          severity: 'LOW',
          confidence: 'MEDIUM',
          description: `A request for a path that does not exist returned ${nf.response.status} instead of 404.`,
          impact: 'Unhandled errors on simple requests often mean other inputs also reach unhandled code paths.',
          remediation: 'Add a catch-all 404 handler and a global error handler that returns a generic response.',
          references: ['https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html'],
          evidence: [evidenceFrom(nf, `GET ${nf.request.url} returned ${nf.response.status}.`, true)],
          exchange: nf,
        }),
      );
    }
    return findings;
  },
};
