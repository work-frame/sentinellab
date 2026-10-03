import { createHash } from 'node:crypto';
import type { Evidence, FindingDraft, HttpExchange } from '../types';
import { redactBody, redactHeaders, redactRequestHeaders } from '../http/redact';

const MAX_EVIDENCE_BODY = 1500;

export function header(ex: HttpExchange | undefined, name: string): string | undefined {
  return ex?.response.headers[name.toLowerCase()]?.[0];
}

export function headerAll(ex: HttpExchange | undefined, name: string): string[] {
  return ex?.response.headers[name.toLowerCase()] ?? [];
}

export function isHtml(ex: HttpExchange): boolean {
  return (header(ex, 'content-type') ?? '').toLowerCase().includes('text/html');
}

export function isHttps(ex: HttpExchange): boolean {
  return ex.request.url.startsWith('https:');
}

/** Build redacted evidence from an exchange. Bodies are only kept on request. */
export function evidenceFrom(ex: HttpExchange, summary: string, includeBody = false): Evidence {
  const body = includeBody ? redactBody(ex.response.bodySnippet).slice(0, MAX_EVIDENCE_BODY) : undefined;
  return {
    summary,
    request: { ...ex.request, headers: redactRequestHeaders(ex.request.headers) },
    response: {
      status: ex.response.status,
      headers: redactHeaders(ex.response.headers),
      bodyTruncated: ex.response.bodyTruncated || ex.response.bodySnippet.length > MAX_EVIDENCE_BODY,
      ...(body !== undefined ? { bodySnippet: body } : {}),
    },
  };
}

type DraftInput = Omit<FindingDraft, 'fingerprint' | 'module' | 'endpoint' | 'method'> & {
  exchange: HttpExchange;
  /** Extra value that separates two findings of the same rule, e.g. a cookie name. */
  discriminator?: string;
};

export function makeFinding(module: string, input: DraftInput): FindingDraft {
  const { exchange, discriminator, ...rest } = input;
  const endpoint = exchange.request.url;
  const method = exchange.request.method;
  const fingerprint = createHash('sha256')
    .update([input.ruleId, method, endpoint, discriminator ?? ''].join('\n'))
    .digest('hex');
  return { ...rest, endpoint, method, module, fingerprint };
}
