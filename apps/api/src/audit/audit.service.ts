import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { ClientInfo } from '../common/request-context';

export type AuditAction =
  | 'auth.register'
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'target.created'
  | 'target.updated'
  | 'target.authorized'
  | 'target.disabled'
  | 'target.enabled'
  | 'target.deleted'
  | 'scan.started'
  | 'scan.cancelled'
  | 'finding.status_changed'
  | 'report.generated';

/** Keys that must never be written to the audit log, at any depth. */
const FORBIDDEN_KEYS = /pass(word)?|secret|token|api[-_]?key|authorization|cookie|credential/i;

export function sanitizeMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeMetadata);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = FORBIDDEN_KEYS.test(k) ? '[REDACTED]' : sanitizeMetadata(v);
    return out;
  }
  return value;
}

export interface AuditEntry {
  action: AuditAction;
  actorId?: string | null;
  resourceType?: string;
  resourceId?: string;
  client?: ClientInfo;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write an audit entry. A failure to write is logged but does not fail the
   * user's request, because the action itself already happened.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          actorId: entry.actorId ?? null,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          ipAddress: entry.client?.ipAddress ?? null,
          userAgent: entry.client?.userAgent ?? null,
          metadata: entry.metadata ? (sanitizeMetadata(entry.metadata) as Prisma.InputJsonValue) : undefined,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log for ${entry.action}: ${(err as Error).message}`);
    }
  }
}
