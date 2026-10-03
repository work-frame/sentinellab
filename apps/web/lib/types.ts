import type { Confidence, FindingStatus, ScanStatus, Severity, TargetEnvironment } from '@sentinellab/types';

export type { Confidence, FindingStatus, ScanStatus, Severity, TargetEnvironment };

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MEMBER';
  createdAt: string;
}

export interface ScanSummary {
  id: string;
  status: ScanStatus;
  queuedAt: string;
  finishedAt: string | null;
}

export interface Target {
  id: string;
  name: string;
  description: string | null;
  baseUrl: string;
  environment: TargetEnvironment;
  isDemo: boolean;
  enabled: boolean;
  authorizationConfirmedAt: string | null;
  authorizationNote: string | null;
  lastScanAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastScan?: ScanSummary | null;
  openFindings?: number;
  openFindingsBySeverity?: Partial<Record<Severity, number>>;
}

export interface ModuleRun {
  id: string;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  findingCount: number;
  durationMs: number | null;
  error: string | null;
}

export interface Scan {
  id: string;
  status: ScanStatus;
  progress: number;
  currentModule: string | null;
  targetUrl: string;
  requestCount: number | null;
  error: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  cancelRequested: boolean;
  target: { id: string; name: string; baseUrl?: string; environment?: TargetEnvironment; isDemo?: boolean };
  findingCount?: number;
  modules?: ModuleRun[];
  findingsBySeverity?: Partial<Record<Severity, number>>;
  reports?: { id: string; title: string; format: 'MARKDOWN' | 'HTML'; createdAt: string }[];
  requestedBy?: { name: string; email: string };
}

export interface FindingListItem {
  id: string;
  title: string;
  type: string;
  severity: Severity;
  confidence: Confidence;
  status: FindingStatus;
  endpoint: string;
  method: string;
  module: string;
  createdAt: string;
  scanId: string;
  target: { id: string; name: string };
}

export interface EvidenceItem {
  id: string;
  summary: string;
  request: { method: string; url: string; headers: Record<string, string> };
  response: { status: number; headers: Record<string, string[]>; bodySnippet?: string; bodyTruncated: boolean };
}

export interface Finding extends FindingListItem {
  ruleId: string;
  description: string;
  impact: string;
  remediation: string;
  references: string[];
  statusNote: string | null;
  statusChangedAt: string | null;
  evidence: EvidenceItem[];
  target: { id: string; name: string; baseUrl: string; environment: TargetEnvironment; isDemo: boolean };
  scan: { id: string; status: ScanStatus; queuedAt: string; finishedAt: string | null };
}

export interface ReportItem {
  id: string;
  title: string;
  format: 'MARKDOWN' | 'HTML';
  createdAt: string;
  scan: { id: string; finishedAt: string | null; target: { id: string; name: string } };
  generatedBy: { name: string };
}

export interface Dashboard {
  scans: { total: number; completed: number; active: number; failed: number; cancelled: number };
  findings: { total: number; open: number; openBySeverity: Record<Severity, number> };
  recentFindings: { id: string; title: string; severity: Severity; status: FindingStatus; endpoint: string; createdAt: string; target: { id: string; name: string } }[];
  recentScans: { id: string; status: ScanStatus; progress: number; queuedAt: string; finishedAt: string | null; findingCount: number; target: { id: string; name: string } }[];
  targetHealth: { id: string; name: string; enabled: boolean; authorized: boolean; lastScanAt: string | null; lastScanStatus: ScanStatus | null; openFindings: number }[];
}

export interface DemoTarget {
  key: string;
  name: string;
  baseUrl: string;
  description: string;
  warning: string;
  targetId: string | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  ipAddress: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
  actor: { email: string; name: string } | null;
}
