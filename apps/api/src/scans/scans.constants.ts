export const SCAN_QUEUE = 'scans';
export const ACTIVE_STATUSES = ['QUEUED', 'RUNNING'] as const;

export interface ScanJobData {
  scanId: string;
}
