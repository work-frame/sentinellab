import { escapeMd, renderHtml, renderMarkdown, type ReportData } from './report-renderer';

const xss = '<script>alert(1)</script>';

function data(overrides: Partial<ReportData> = {}): ReportData {
  return {
    title: `Report for ${xss}`,
    generatedAt: new Date('2026-01-01T00:00:00Z'),
    generatedBy: 'Ada',
    target: {
      name: xss,
      baseUrl: 'http://localhost:8081/',
      environment: 'LOCAL_DEMO',
      description: `desc ${xss}`,
      authorizationConfirmedAt: new Date('2026-01-01T00:00:00Z'),
      authorizationNote: null,
    },
    scan: { id: 'scan-1', startedAt: null, finishedAt: null, requestCount: 4, modules: [{ name: 'cors', status: 'COMPLETED', findingCount: 1 }] },
    findings: [
      {
        title: `Finding ${xss}`,
        type: 'CORS Misconfiguration',
        severity: 'HIGH',
        confidence: 'HIGH',
        status: 'OPEN',
        endpoint: 'http://localhost:8081/',
        method: 'GET',
        description: xss,
        impact: 'impact',
        remediation: 'fix it',
        references: ['https://example.com/ref'],
        module: 'cors',
        createdAt: new Date(),
        evidence: [{ summary: xss, request: { url: xss }, response: { status: 200 } }],
      },
    ],
    ...overrides,
  };
}

describe('report renderer', () => {
  it('escapes every user-controlled value in HTML', () => {
    const html = renderHtml(data());
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes Markdown so raw HTML cannot pass through', () => {
    const md = renderMarkdown(data());
    // Fenced code blocks render as literal text, so only prose outside them must be escaped.
    const prose = md.replace(/```json[\s\S]*?```/g, '');
    expect(prose).not.toMatch(/<script>/);
    expect(md).toContain('```json');
    expect(escapeMd('a|b\nc')).toBe('a\\|b c');
  });

  it('contains all nine sections and the limitations statement', () => {
    const md = renderMarkdown(data());
    for (const heading of ['Executive summary', 'Scope', 'Methodology', 'Scan information', 'Findings', 'Severity breakdown', 'Evidence', 'Remediation recommendations', 'Conclusion']) {
      expect(md).toContain(heading);
    }
    expect(md).toContain('does not prove that the application is secure');
  });

  it('writes an honest summary when there are no findings', () => {
    const md = renderMarkdown(data({ findings: [] }));
    expect(md).toContain('found no issues');
    expect(md).toContain('see the limitations');
  });
});
