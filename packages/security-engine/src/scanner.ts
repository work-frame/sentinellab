import { SEVERITY_RANK } from '@sentinellab/types';
import { ALL_CHECKS } from './checks';
import type { TargetPolicy } from './http/target-policy';
import { runRecon } from './recon';
import type { CheckModule, FindingDraft, ReconResult } from './types';

export class ScanCancelledError extends Error {
  constructor() {
    super('Scan was cancelled');
    this.name = 'ScanCancelledError';
  }
}

export type ModuleStatus = 'COMPLETED' | 'FAILED' | 'SKIPPED';

export interface ModuleResult {
  name: string;
  status: ModuleStatus;
  findingCount: number;
  durationMs: number;
  error?: string;
}

export interface ProgressEvent {
  module: string;
  status: 'STARTED' | ModuleStatus;
  /** 0 to 100. */
  progress: number;
}

export interface ScanOptions {
  baseUrl: string;
  policy: TargetPolicy;
  signal?: AbortSignal;
  timeoutMs?: number;
  checks?: CheckModule[];
  onProgress?: (event: ProgressEvent) => void | Promise<void>;
}

export interface ScanResult {
  findings: FindingDraft[];
  modules: ModuleResult[];
  requestCount: number;
}

/** Drop duplicate fingerprints and sort by severity, then title. */
export function normalizeFindings(findings: FindingDraft[]): FindingDraft[] {
  const byFingerprint = new Map<string, FindingDraft>();
  for (const f of findings) if (!byFingerprint.has(f.fingerprint)) byFingerprint.set(f.fingerprint, f);
  return [...byFingerprint.values()].sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || a.title.localeCompare(b.title),
  );
}

function countRequests(recon: ReconResult): number {
  return 1 + recon.redirects.length + [recon.options, recon.notFound, recon.corsProbe].filter(Boolean).length;
}

/**
 * Pipeline: recon -> each check -> normalization. A failing check is recorded
 * and the scan continues; a failing recon (target unreachable or blocked by
 * policy) fails the scan, because no check could produce a valid result.
 */
export async function runScan(opts: ScanOptions): Promise<ScanResult> {
  const checks = opts.checks ?? ALL_CHECKS;
  const total = checks.length + 1;
  const assertActive = () => {
    if (opts.signal?.aborted) throw new ScanCancelledError();
  };

  assertActive();
  await opts.onProgress?.({ module: 'recon', status: 'STARTED', progress: 0 });
  const reconStart = Date.now();
  const recon = await runRecon(opts.baseUrl, { policy: opts.policy, signal: opts.signal, timeoutMs: opts.timeoutMs });
  const modules: ModuleResult[] = [
    { name: 'recon', status: 'COMPLETED', findingCount: 0, durationMs: Date.now() - reconStart },
  ];
  await opts.onProgress?.({ module: 'recon', status: 'COMPLETED', progress: Math.round(100 / total) });

  const findings: FindingDraft[] = [];
  for (const [i, check] of checks.entries()) {
    assertActive();
    await opts.onProgress?.({ module: check.name, status: 'STARTED', progress: Math.round(((i + 1) * 100) / total) });
    const started = Date.now();
    try {
      const result = check.run(recon);
      findings.push(...result);
      modules.push({ name: check.name, status: 'COMPLETED', findingCount: result.length, durationMs: Date.now() - started });
    } catch (err) {
      modules.push({
        name: check.name,
        status: 'FAILED',
        findingCount: 0,
        durationMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    const last = modules[modules.length - 1]!;
    await opts.onProgress?.({ module: check.name, status: last.status, progress: Math.round(((i + 2) * 100) / total) });
  }

  return { findings: normalizeFindings(findings), modules, requestCount: countRequests(recon) };
}
