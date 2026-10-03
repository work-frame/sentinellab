import { SEVERITIES, SEVERITY_LABELS, FINDING_STATUS_LABELS, type FindingStatus, type Severity } from '@sentinellab/types';

export interface ReportEvidence {
  summary: string;
  request: unknown;
  response: unknown;
}

export interface ReportFinding {
  title: string;
  type: string;
  severity: Severity;
  confidence: string;
  status: FindingStatus;
  endpoint: string;
  method: string;
  description: string;
  impact: string;
  remediation: string;
  references: string[];
  module: string;
  createdAt: Date;
  evidence: ReportEvidence[];
}

export interface ReportData {
  title: string;
  generatedAt: Date;
  generatedBy: string;
  target: { name: string; baseUrl: string; environment: string; description: string | null; authorizationConfirmedAt: Date | null; authorizationNote: string | null };
  scan: { id: string; startedAt: Date | null; finishedAt: Date | null; requestCount: number | null; modules: { name: string; status: string; findingCount: number }[] };
  findings: ReportFinding[];
}

const LIMITATIONS =
  'This report covers automated, mostly passive checks of HTTP responses from the base URL. It does not prove that the application is secure. ' +
  'Business logic flaws, authorization bugs, injection flaws and issues behind authentication are out of scope for this scan. ' +
  'Use it alongside code review and manual testing.';

const METHODOLOGY = [
  'Recon: up to five same-host redirects from the base URL, plus one OPTIONS request, one request to a random non-existent path and one request with an untrusted Origin header. Only GET and OPTIONS were sent.',
  'Each check module reads those responses without sending further traffic: security headers, cookie attributes, transport security, CORS policy, version disclosure, advertised HTTP methods, error disclosure and rate limit headers.',
  'Findings were de-duplicated by fingerprint and classified with fixed severities per rule. No CVSS scores are calculated.',
  'Evidence was redacted before storage: cookie values, credential headers and secret-like strings in bodies are replaced with [REDACTED].',
];

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC') : 'n/a';
}

function counts(findings: ReportFinding[]): Record<Severity, number> {
  const c = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<Severity, number>;
  for (const f of findings) c[f.severity] += 1;
  return c;
}

function executiveSummary(data: ReportData): string {
  const c = counts(data.findings);
  const total = data.findings.length;
  if (total === 0) {
    return `The automated checks found no issues on ${data.target.baseUrl}. That only means none of the checks described under Methodology matched; see the limitations below.`;
  }
  const serious = c.CRITICAL + c.HIGH;
  const parts = SEVERITIES.filter((s) => c[s] > 0).map((s) => `${c[s]} ${SEVERITY_LABELS[s].toLowerCase()}`);
  return (
    `The scan of ${data.target.baseUrl} produced ${total} finding${total === 1 ? '' : 's'}: ${parts.join(', ')}. ` +
    (serious > 0
      ? `Fix the ${serious} critical and high severity finding${serious === 1 ? '' : 's'} first.`
      : 'No critical or high severity issues were found; the findings are configuration hardening items.')
  );
}

/** Escape characters that would change Markdown structure or inject HTML. */
export function escapeMd(text: string): string {
  return text.replace(/[\\`*_{}[\]()#+!|<>]/g, (ch) => `\\${ch}`).replace(/\r?\n/g, ' ');
}

export function renderMarkdown(data: ReportData): string {
  const c = counts(data.findings);
  const lines: string[] = [];
  lines.push(`# ${escapeMd(data.title)}`, '');
  lines.push(`Generated ${fmtDate(data.generatedAt)} by ${escapeMd(data.generatedBy)}.`, '');
  lines.push('## 1. Executive summary', '', escapeMd(executiveSummary(data)), '');
  lines.push('## 2. Scope', '');
  lines.push(`- Target: ${escapeMd(data.target.name)}`);
  lines.push(`- Base URL: \`${data.target.baseUrl.replace(/`/g, '')}\``);
  lines.push(`- Environment: ${data.target.environment}`);
  lines.push(`- Authorization confirmed: ${fmtDate(data.target.authorizationConfirmedAt)}${data.target.authorizationNote ? ` (${escapeMd(data.target.authorizationNote)})` : ''}`);
  if (data.target.description) lines.push(`- Description: ${escapeMd(data.target.description)}`);
  lines.push('');
  lines.push('## 3. Methodology', '', ...METHODOLOGY.map((m) => `- ${m}`), '');
  lines.push('## 4. Scan information', '');
  lines.push(`- Scan ID: ${data.scan.id}`, `- Started: ${fmtDate(data.scan.startedAt)}`, `- Finished: ${fmtDate(data.scan.finishedAt)}`);
  lines.push(`- Requests sent: ${data.scan.requestCount ?? 'n/a'}`, '');
  lines.push('| Module | Status | Findings |', '| --- | --- | --- |');
  for (const m of data.scan.modules) lines.push(`| ${m.name} | ${m.status} | ${m.findingCount} |`);
  lines.push('');
  lines.push('## 5. Findings', '');
  if (data.findings.length === 0) lines.push('No findings.', '');
  data.findings.forEach((f, i) => {
    lines.push(`### 5.${i + 1} ${escapeMd(f.title)}`, '');
    lines.push(`- Severity: ${SEVERITY_LABELS[f.severity]} (confidence: ${f.confidence.toLowerCase()})`);
    lines.push(`- Status: ${FINDING_STATUS_LABELS[f.status]}`);
    lines.push(`- Type: ${escapeMd(f.type)}`);
    lines.push(`- Endpoint: \`${f.method} ${f.endpoint.replace(/`/g, '')}\``);
    lines.push(`- Module: ${f.module}`, '');
    lines.push(`**Description.** ${escapeMd(f.description)}`, '');
    lines.push(`**Impact.** ${escapeMd(f.impact)}`, '');
  });
  lines.push('## 6. Severity breakdown', '', '| Severity | Count |', '| --- | --- |');
  for (const s of SEVERITIES) lines.push(`| ${SEVERITY_LABELS[s]} | ${c[s]} |`);
  lines.push('');
  lines.push('## 7. Evidence', '');
  data.findings.forEach((f, i) => {
    lines.push(`### 7.${i + 1} ${escapeMd(f.title)}`, '');
    for (const e of f.evidence) {
      lines.push(`${escapeMd(e.summary)}`, '', '```json', JSON.stringify({ request: e.request, response: e.response }, null, 2).replace(/```/g, '` ` `'), '```', '');
    }
  });
  lines.push('## 8. Remediation recommendations', '');
  data.findings.forEach((f, i) => {
    lines.push(`${i + 1}. **${escapeMd(f.title)}** (${SEVERITY_LABELS[f.severity]}): ${escapeMd(f.remediation)}`);
    for (const r of f.references) lines.push(`   - <${r.replace(/[<>]/g, '')}>`);
  });
  if (data.findings.length === 0) lines.push('No remediation items from this scan.');
  lines.push('');
  lines.push('## 9. Conclusion', '', escapeMd(LIMITATIONS), '');
  return lines.join('\n');
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

const SEVERITY_COLORS: Record<Severity, string> = {
  CRITICAL: '#b42318',
  HIGH: '#c4320a',
  MEDIUM: '#b54708',
  LOW: '#175cd3',
  INFO: '#475467',
};

/** Self-contained HTML report. Every dynamic value goes through escapeHtml. */
export function renderHtml(data: ReportData): string {
  const e = escapeHtml;
  const c = counts(data.findings);
  const badge = (s: Severity) => `<span class="sev" style="background:${SEVERITY_COLORS[s]}">${SEVERITY_LABELS[s]}</span>`;
  const findingBlocks = data.findings
    .map(
      (f, i) => `
    <section class="finding">
      <h3>5.${i + 1} ${e(f.title)} ${badge(f.severity)}</h3>
      <dl>
        <dt>Status</dt><dd>${FINDING_STATUS_LABELS[f.status]}</dd>
        <dt>Confidence</dt><dd>${e(f.confidence.toLowerCase())}</dd>
        <dt>Type</dt><dd>${e(f.type)}</dd>
        <dt>Endpoint</dt><dd><code>${e(f.method)} ${e(f.endpoint)}</code></dd>
        <dt>Module</dt><dd>${e(f.module)}</dd>
      </dl>
      <p><strong>Description.</strong> ${e(f.description)}</p>
      <p><strong>Impact.</strong> ${e(f.impact)}</p>
    </section>`,
    )
    .join('');
  const evidenceBlocks = data.findings
    .map(
      (f, i) => `
    <h3>7.${i + 1} ${e(f.title)}</h3>
    ${f.evidence.map((ev) => `<p>${e(ev.summary)}</p><pre>${e(JSON.stringify({ request: ev.request, response: ev.response }, null, 2))}</pre>`).join('')}`,
    )
    .join('');
  const remediation = data.findings
    .map(
      (f) =>
        `<li><strong>${e(f.title)}</strong> (${SEVERITY_LABELS[f.severity]}): ${e(f.remediation)}${
          f.references.length ? `<ul>${f.references.map((r) => `<li>${e(r)}</li>`).join('')}</ul>` : ''
        }</li>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(data.title)}</title>
<style>
  body { font: 15px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; color: #101828; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
  h1 { font-size: 1.8rem; margin-bottom: .25rem; } h2 { margin-top: 2.2rem; border-bottom: 1px solid #d0d5dd; padding-bottom: .3rem; }
  .meta { color: #475467; } table { border-collapse: collapse; } td, th { border: 1px solid #d0d5dd; padding: .35rem .7rem; text-align: left; }
  .sev { color: #fff; border-radius: 4px; padding: .1rem .45rem; font-size: .75rem; vertical-align: middle; }
  .finding { border: 1px solid #d0d5dd; border-radius: 8px; padding: .5rem 1rem; margin: 1rem 0; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: .2rem 1rem; } dt { color: #475467; }
  pre { background: #f2f4f7; padding: .8rem; overflow-x: auto; font-size: .8rem; white-space: pre-wrap; word-break: break-all; }
  .note { background: #fffaeb; border-left: 4px solid #b54708; padding: .6rem 1rem; }
  @media print { body { margin: 0; } .finding { break-inside: avoid; } }
</style>
</head>
<body>
<h1>${e(data.title)}</h1>
<p class="meta">Generated ${e(fmtDate(data.generatedAt))} by ${e(data.generatedBy)}</p>
<h2>1. Executive summary</h2>
<p>${e(executiveSummary(data))}</p>
<h2>2. Scope</h2>
<dl>
  <dt>Target</dt><dd>${e(data.target.name)}</dd>
  <dt>Base URL</dt><dd><code>${e(data.target.baseUrl)}</code></dd>
  <dt>Environment</dt><dd>${e(data.target.environment)}</dd>
  <dt>Authorization confirmed</dt><dd>${e(fmtDate(data.target.authorizationConfirmedAt))}${data.target.authorizationNote ? ` (${e(data.target.authorizationNote)})` : ''}</dd>
  ${data.target.description ? `<dt>Description</dt><dd>${e(data.target.description)}</dd>` : ''}
</dl>
<h2>3. Methodology</h2>
<ul>${METHODOLOGY.map((m) => `<li>${e(m)}</li>`).join('')}</ul>
<h2>4. Scan information</h2>
<dl>
  <dt>Scan ID</dt><dd>${e(data.scan.id)}</dd>
  <dt>Started</dt><dd>${e(fmtDate(data.scan.startedAt))}</dd>
  <dt>Finished</dt><dd>${e(fmtDate(data.scan.finishedAt))}</dd>
  <dt>Requests sent</dt><dd>${data.scan.requestCount ?? 'n/a'}</dd>
</dl>
<table><thead><tr><th>Module</th><th>Status</th><th>Findings</th></tr></thead><tbody>
${data.scan.modules.map((m) => `<tr><td>${e(m.name)}</td><td>${e(m.status)}</td><td>${m.findingCount}</td></tr>`).join('')}
</tbody></table>
<h2>5. Findings</h2>
${findingBlocks || '<p>No findings.</p>'}
<h2>6. Severity breakdown</h2>
<table><thead><tr><th>Severity</th><th>Count</th></tr></thead><tbody>
${SEVERITIES.map((s) => `<tr><td>${badge(s)}</td><td>${c[s]}</td></tr>`).join('')}
</tbody></table>
<h2>7. Evidence</h2>
${evidenceBlocks || '<p>No evidence.</p>'}
<h2>8. Remediation recommendations</h2>
${remediation ? `<ol>${remediation}</ol>` : '<p>No remediation items from this scan.</p>'}
<h2>9. Conclusion</h2>
<p class="note">${e(LIMITATIONS)}</p>
</body>
</html>
`;
}
