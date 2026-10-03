import { Inject, Injectable, Logger } from '@nestjs/common';
import { FindingStatus, Prisma } from '@prisma/client';
import { ALL_CHECKS, runScan, ScanCancelledError, TargetPolicyError, type FindingDraft } from '@sentinellab/security-engine';
import { APP_CONFIG, type AppConfig } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

const CANCEL_POLL_MS = 500;
/** Statuses a reviewer chose on purpose; a re-scan keeps them for the same issue. */
const STICKY_STATUSES: FindingStatus[] = ['FALSE_POSITIVE', 'ACCEPTED_RISK'];

/** Translate low-level errors into messages that are safe and useful to show. */
export function describeScanError(err: unknown): { message: string; internal: boolean } {
  if (err instanceof TargetPolicyError) return { message: err.message, internal: false };
  const code = (err as { code?: string; cause?: { code?: string } })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
  const known: Record<string, string> = {
    ECONNREFUSED: 'Connection refused. Is the target running?',
    ENOTFOUND: 'Host name could not be resolved.',
    EAI_AGAIN: 'DNS lookup timed out.',
    ECONNRESET: 'The target closed the connection.',
    UND_ERR_CONNECT_TIMEOUT: 'Timed out connecting to the target.',
    UND_ERR_HEADERS_TIMEOUT: 'The target did not respond in time.',
    UND_ERR_BODY_TIMEOUT: 'The target stopped sending data.',
    UND_ERR_SOCKET: 'The connection to the target failed.',
    CERT_HAS_EXPIRED: 'The target TLS certificate has expired.',
    DEPTH_ZERO_SELF_SIGNED_CERT: 'The target uses a self-signed TLS certificate.',
    ERR_TLS_CERT_ALTNAME_INVALID: 'The target TLS certificate does not match the host name.',
  };
  if (code && known[code]) return { message: known[code]!, internal: false };
  return { message: 'The scan failed because of an internal error.', internal: true };
}

@Injectable()
export class ScanRunnerService {
  private readonly logger = new Logger(ScanRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async run(scanId: string): Promise<void> {
    // Claim the scan atomically. If it was cancelled while queued, stop here.
    const claimed = await this.prisma.scan.updateMany({
      where: { id: scanId, status: 'QUEUED' },
      data: { status: 'RUNNING', startedAt: new Date(), progress: 0 },
    });
    if (claimed.count === 0) return;

    const scan = await this.prisma.scan.findUniqueOrThrow({ where: { id: scanId }, include: { target: true } });
    if (!scan.target.enabled || !scan.target.authorizationConfirmedAt) {
      await this.finish(scanId, 'FAILED', { error: 'Target was disabled or lost its authorization before the scan started.' });
      return;
    }

    const moduleNames = ['recon', ...ALL_CHECKS.map((c) => c.name)];
    await this.prisma.scanModuleRun.createMany({
      data: moduleNames.map((name, position) => ({ scanId, name, position })),
      skipDuplicates: true,
    });

    const controller = new AbortController();
    const poll = setInterval(() => {
      this.prisma.scan
        .findUnique({ where: { id: scanId }, select: { cancelRequested: true } })
        .then((s) => {
          if (s?.cancelRequested) controller.abort();
        })
        .catch(() => undefined);
    }, CANCEL_POLL_MS);

    try {
      const result = await runScan({
        baseUrl: scan.targetUrl,
        policy: this.config.targetPolicy,
        signal: controller.signal,
        timeoutMs: this.config.scanTimeoutMs,
        onProgress: async (e) => {
          await this.prisma.$transaction([
            this.prisma.scan.update({ where: { id: scanId }, data: { progress: Math.min(e.progress, 99), currentModule: e.module } }),
            this.prisma.scanModuleRun.update({
              where: { scanId_name: { scanId, name: e.module } },
              data: { status: e.status === 'STARTED' ? 'RUNNING' : e.status },
            }),
          ]);
        },
      });
      if (controller.signal.aborted) throw new ScanCancelledError();
      await this.persistResults(scanId, scan.targetId, result.findings, result.modules, result.requestCount);
    } catch (err) {
      if (err instanceof ScanCancelledError || controller.signal.aborted) {
        await this.finish(scanId, 'CANCELLED', {});
      } else {
        const { message, internal } = describeScanError(err);
        if (internal) this.logger.error(`Scan ${scanId} failed`, err instanceof Error ? err.stack : String(err));
        await this.finish(scanId, 'FAILED', { error: message });
      }
    } finally {
      clearInterval(poll);
    }
  }

  private async persistResults(
    scanId: string,
    targetId: string,
    findings: FindingDraft[],
    modules: { name: string; status: string; findingCount: number; durationMs: number; error?: string }[],
    requestCount: number,
  ) {
    // Carry deliberate review decisions over from the most recent earlier finding with the same fingerprint.
    const previous = await this.prisma.finding.findMany({
      where: { targetId, fingerprint: { in: findings.map((f) => f.fingerprint) }, scanId: { not: scanId } },
      orderBy: { createdAt: 'desc' },
      distinct: ['fingerprint'],
      select: { fingerprint: true, status: true, statusNote: true },
    });
    const sticky = new Map(previous.filter((p) => STICKY_STATUSES.includes(p.status)).map((p) => [p.fingerprint, p]));
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      for (const f of findings) {
        const carried = sticky.get(f.fingerprint);
        await tx.finding.create({
          data: {
            scanId,
            targetId,
            ruleId: f.ruleId,
            fingerprint: f.fingerprint,
            title: f.title,
            type: f.type,
            severity: f.severity,
            confidence: f.confidence,
            endpoint: f.endpoint,
            method: f.method,
            description: f.description,
            impact: f.impact,
            remediation: f.remediation,
            references: f.references,
            module: f.module,
            status: carried?.status ?? 'OPEN',
            statusNote: carried ? `Carried over from an earlier scan. ${carried.statusNote ?? ''}`.trim() : null,
            statusChangedAt: carried ? now : null,
            evidence: {
              create: f.evidence.map((e) => ({
                summary: e.summary,
                request: e.request as unknown as Prisma.InputJsonValue,
                response: e.response as unknown as Prisma.InputJsonValue,
              })),
            },
          },
        });
      }
      for (const m of modules) {
        await tx.scanModuleRun.update({
          where: { scanId_name: { scanId, name: m.name } },
          data: { status: m.status as 'COMPLETED' | 'FAILED' | 'SKIPPED', findingCount: m.findingCount, durationMs: m.durationMs, error: m.error ?? null },
        });
      }
      await tx.scan.update({
        where: { id: scanId },
        data: { status: 'COMPLETED', progress: 100, currentModule: null, finishedAt: now, requestCount },
      });
      await tx.target.update({ where: { id: targetId }, data: { lastScanAt: now } });
    });
  }

  private async finish(scanId: string, status: 'FAILED' | 'CANCELLED', extra: { error?: string }) {
    await this.prisma.$transaction([
      this.prisma.scan.update({
        where: { id: scanId },
        data: { status, finishedAt: new Date(), currentModule: null, error: extra.error ?? null },
      }),
      // The module that was running when a failure happened is the one that failed.
      this.prisma.scanModuleRun.updateMany({
        where: { scanId, status: 'RUNNING' },
        data: { status: status === 'FAILED' ? 'FAILED' : 'SKIPPED', error: status === 'FAILED' ? (extra.error ?? null) : null },
      }),
      this.prisma.scanModuleRun.updateMany({ where: { scanId, status: 'PENDING' }, data: { status: 'SKIPPED' } }),
    ]);
  }
}
