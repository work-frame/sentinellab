import type { Confidence, Severity } from '@sentinellab/types';

/** Response headers keep every value so repeated headers (Set-Cookie) survive. */
export type HeaderMap = Record<string, string[]>;

export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
}

export interface RecordedResponse {
  status: number;
  headers: HeaderMap;
  /** First bytes of the body, decoded as UTF-8. Never the full body. */
  bodySnippet: string;
  bodyTruncated: boolean;
}

export interface HttpExchange {
  request: RecordedRequest;
  response: RecordedResponse;
  durationMs: number;
}

/**
 * Everything the recon stage collected. Checks only read this object, so each
 * check is a pure function and can be unit tested with hand-built fixtures.
 */
export interface ReconResult {
  baseUrl: string;
  /** Final response for GET on the base URL, after same-host redirects. */
  baseline: HttpExchange;
  /** Redirect responses that led to the baseline, in order. */
  redirects: HttpExchange[];
  options?: HttpExchange;
  notFound?: HttpExchange;
  corsProbe?: HttpExchange;
  /** Origin value sent in the CORS probe. */
  corsProbeOrigin: string;
}

export interface Evidence {
  /** One line a reviewer can read without opening the raw exchange. */
  summary: string;
  request: RecordedRequest;
  response: Omit<RecordedResponse, 'bodySnippet'> & { bodySnippet?: string };
}

export interface FindingDraft {
  /** Stable identifier of the rule that produced this finding. */
  ruleId: string;
  title: string;
  /** Vulnerability category, for example "Security Misconfiguration". */
  type: string;
  severity: Severity;
  confidence: Confidence;
  endpoint: string;
  method: string;
  description: string;
  impact: string;
  remediation: string;
  references: string[];
  evidence: Evidence[];
  /** Same issue on the same endpoint always produces the same fingerprint. */
  fingerprint: string;
  module: string;
}

export interface CheckModule {
  /** Machine name stored with each finding, for example "security-headers". */
  name: string;
  description: string;
  run(recon: ReconResult): FindingDraft[];
}
