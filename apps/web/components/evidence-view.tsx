import type { EvidenceItem } from '@/lib/types';

/**
 * Renders stored evidence as plain text. Values were redacted by the scanner
 * before storage, and React escapes everything here, so a response body that
 * contains HTML or script is shown, never executed.
 */
export function EvidenceView({ evidence }: { evidence: EvidenceItem }) {
  const req = evidence.request;
  const res = evidence.response;
  const requestText = [`${req.method} ${req.url}`, ...Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`)].join('\n');
  const responseText = [`HTTP ${res.status}`, ...Object.entries(res.headers).flatMap(([k, vs]) => vs.map((v) => `${k}: ${v}`))].join('\n');

  return (
    <div className="space-y-3">
      <p className="text-sm">{evidence.summary}</p>
      <div className="grid gap-3 xl:grid-cols-2">
        <div>
          <p className="label">Request</p>
          <pre className="mono max-h-72 overflow-auto rounded-md border border-line bg-bg p-3 text-xs leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{requestText}</pre>
        </div>
        <div>
          <p className="label">Response headers</p>
          <pre className="mono max-h-72 overflow-auto rounded-md border border-line bg-bg p-3 text-xs leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{responseText}</pre>
        </div>
      </div>
      {res.bodySnippet !== undefined && (
        <div>
          <p className="label">Response body excerpt{res.bodyTruncated ? ' (truncated)' : ''}</p>
          <pre className="mono max-h-72 overflow-auto rounded-md border border-line bg-bg p-3 text-xs leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]">{res.bodySnippet}</pre>
        </div>
      )}
    </div>
  );
}
