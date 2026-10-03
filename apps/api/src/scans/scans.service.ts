import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Queue } from 'bullmq';
import { AuditService } from '../audit/audit.service';
import type { AuthUser, ClientInfo } from '../common/request-context';
import { paginated } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TargetsService } from '../targets/targets.service';
import { ACTIVE_STATUSES, SCAN_QUEUE, type ScanJobData } from './scans.constants';
import type { ListScansQuery } from './scans.dto';

const STALE_AFTER_MS = 30 * 60_000;

@Injectable()
export class ScansService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ScansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly targets: TargetsService,
    private readonly audit: AuditService,
    @InjectQueue(SCAN_QUEUE) private readonly queue: Queue<ScanJobData>,
  ) {}

  /** A scan left RUNNING by a crashed worker would block its target forever. */
  async onApplicationBootstrap() {
    const { count } = await this.prisma.scan.updateMany({
      where: { status: 'RUNNING', startedAt: { lt: new Date(Date.now() - STALE_AFTER_MS) } },
      data: { status: 'FAILED', finishedAt: new Date(), error: 'The scan worker stopped before the scan finished.' },
    });
    if (count > 0) this.logger.warn(`Marked ${count} stale scan(s) as failed`);
  }

  async start(targetId: string, user: AuthUser, client: ClientInfo) {
    const target = await this.targets.findOwned(targetId, user);
    if (!target.enabled) throw new BadRequestException('This target is disabled. Enable it before scanning.');
    if (!target.authorizationConfirmedAt) {
      throw new BadRequestException('Confirm that you are authorized to test this target before scanning it.');
    }
    // Re-validate: DNS for the host may have changed since the target was saved.
    await this.targets.validateUrl(target.baseUrl);

    const scan = await this.prisma.$transaction(async (tx) => {
      const active = await tx.scan.count({ where: { targetId, status: { in: [...ACTIVE_STATUSES] } } });
      if (active > 0) throw new ConflictException('A scan is already queued or running for this target');
      return tx.scan.create({ data: { targetId, requestedById: user.id, targetUrl: target.baseUrl } });
    });

    await this.queue.add('scan', { scanId: scan.id }, { jobId: scan.id, attempts: 1, removeOnComplete: 1000, removeOnFail: 1000 });
    await this.audit.record({
      action: 'scan.started',
      actorId: user.id,
      resourceType: 'scan',
      resourceId: scan.id,
      client,
      metadata: { targetId, targetUrl: target.baseUrl },
    });
    return scan;
  }

  async list(user: AuthUser, q: ListScansQuery) {
    const where: Prisma.ScanWhereInput = { target: { ownerId: user.id } };
    if (q.targetId) where.targetId = q.targetId;
    if (q.status) where.status = q.status;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.scan.findMany({
        where,
        orderBy: { queuedAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
        include: { target: { select: { id: true, name: true } }, _count: { select: { findings: true } } },
      }),
      this.prisma.scan.count({ where }),
    ]);
    return paginated(
      items.map(({ _count, ...s }) => ({ ...s, findingCount: _count.findings })),
      total,
      q,
    );
  }

  async findOwned(id: string, user: AuthUser) {
    const scan = await this.prisma.scan.findFirst({ where: { id, target: { ownerId: user.id } } });
    if (!scan) throw new NotFoundException('Scan not found');
    return scan;
  }

  async get(id: string, user: AuthUser) {
    await this.findOwned(id, user);
    const [scan, severity] = await Promise.all([
      this.prisma.scan.findUniqueOrThrow({
        where: { id },
        include: {
          target: { select: { id: true, name: true, baseUrl: true, environment: true, isDemo: true } },
          requestedBy: { select: { id: true, name: true, email: true } },
          modules: { orderBy: { position: 'asc' } },
          reports: { orderBy: { createdAt: 'desc' }, select: { id: true, title: true, format: true, createdAt: true } },
        },
      }),
      this.prisma.finding.groupBy({ by: ['severity'], where: { scanId: id }, _count: true }),
    ]);
    return { ...scan, findingsBySeverity: Object.fromEntries(severity.map((s) => [s.severity, s._count])) };
  }

  async cancel(id: string, user: AuthUser, client: ClientInfo) {
    const scan = await this.findOwned(id, user);
    if (scan.status === 'QUEUED') {
      const { count } = await this.prisma.scan.updateMany({
        where: { id, status: 'QUEUED' },
        data: { status: 'CANCELLED', cancelRequested: true, finishedAt: new Date() },
      });
      if (count > 0) await this.queue.remove(id).catch(() => undefined);
      else await this.prisma.scan.update({ where: { id }, data: { cancelRequested: true } });
    } else if (scan.status === 'RUNNING') {
      // The worker polls this flag and aborts between requests.
      await this.prisma.scan.update({ where: { id }, data: { cancelRequested: true } });
    } else {
      throw new ConflictException(`Scan is already ${scan.status.toLowerCase()}`);
    }
    await this.audit.record({ action: 'scan.cancelled', actorId: user.id, resourceType: 'scan', resourceId: id, client });
    return this.prisma.scan.findUniqueOrThrow({ where: { id } });
  }
}
