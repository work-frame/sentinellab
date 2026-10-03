/**
 * Shared domain types for SentinelLab. The API (Prisma enums) and the web app
 * both use these string values, so keep them in sync with prisma/schema.prisma.
 */

export const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CONFIDENCES = ['HIGH', 'MEDIUM', 'LOW'] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export const FINDING_STATUSES = [
  'OPEN',
  'CONFIRMED',
  'FALSE_POSITIVE',
  'RESOLVED',
  'ACCEPTED_RISK',
] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const SCAN_STATUSES = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

export const TARGET_ENVIRONMENTS = ['LOCAL_DEMO', 'DEVELOPMENT', 'STAGING', 'PRODUCTION'] as const;
export type TargetEnvironment = (typeof TARGET_ENVIRONMENTS)[number];

export const SEVERITY_LABELS: Record<Severity, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
  INFO: 'Informational',
};

export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  OPEN: 'Open',
  CONFIRMED: 'Confirmed',
  FALSE_POSITIVE: 'False Positive',
  RESOLVED: 'Resolved',
  ACCEPTED_RISK: 'Accepted Risk',
};

/** Higher number sorts first. */
export const SEVERITY_RANK: Record<Severity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
