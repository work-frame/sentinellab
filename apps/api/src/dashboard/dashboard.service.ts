import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { SEVERITIES } from '@sentinellab/types';
import type { AuthUser } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

const OPEN: Prisma.EnumFindingStatusFilter = { in: ['OPEN', 'CONFIRMED'] };

/** Every number here comes from a database query on the user's own data. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(user: AuthUser) {
    const scanWhere = { target: { ownerId: user.id } };
    const findingWhere = { target: { ownerId: user.id } };

    const [scanStatus, severity, totalFindings, recentFindings, recentScans, targets] = await Promise.all([
      this.prisma.scan.groupBy({ by: ['status'], where: scanWhere, _count: true }),
      this.prisma.finding.groupBy({ by: ['severity'], where: { ...findingWhere, status: OPEN }, _count: true }),
      this.prisma.finding.count({ where: findingWhere }),
      this.prisma.finding.findMany({
        where: findingWhere,
        // Newest scan first; within a scan, most severe first.
        orderBy: [{ scan: { queuedAt: 'desc' } }, { severity: 'asc' }, { title: 'asc' }],
        take: 8,
        select: { id: true, title: true, severity: true, status: true, endpoint: true, createdAt: true, target: { select: { id: true, name: true } } },
      }),
      this.prisma.scan.findMany({
        where: scanWhere,
        orderBy: { queuedAt: 'desc' },
        take: 8,
        select: { id: true, status: true, progress: true, queuedAt: true, finishedAt: true, target: { select: { id: true, name: true } }, _count: { select: { findings: true } } },
      }),
      this.prisma.target.findMany({
        where: { ownerId: user.id },
        orderBy: { name: 'asc' },
        take: 20,
        select: {
          id: true,
          name: true,
          enabled: true,
          authorizationConfirmedAt: true,
          lastScanAt: true,
          scans: { orderBy: { queuedAt: 'desc' }, take: 1, select: { status: true } },
          _count: { select: { findings: { where: { status: OPEN } } } },
        },
      }),
    ]);

    const byStatus = Object.fromEntries(scanStatus.map((s) => [s.status, s._count])) as Record<string, number>;
    const bySeverity = Object.fromEntries(SEVERITIES.map((s) => [s, severity.find((x) => x.severity === s)?._count ?? 0]));

    return {
      scans: {
        total: scanStatus.reduce((sum, s) => sum + s._count, 0),
        completed: byStatus.COMPLETED ?? 0,
        active: (byStatus.QUEUED ?? 0) + (byStatus.RUNNING ?? 0),
        failed: byStatus.FAILED ?? 0,
        cancelled: byStatus.CANCELLED ?? 0,
      },
      findings: {
        total: totalFindings,
        open: Object.values(bySeverity).reduce((a, b) => a + b, 0),
        openBySeverity: bySeverity,
      },
      recentFindings,
      recentScans: recentScans.map(({ _count, ...s }) => ({ ...s, findingCount: _count.findings })),
      targetHealth: targets.map(({ scans, _count, ...t }) => ({
        ...t,
        authorized: Boolean(t.authorizationConfirmedAt),
        lastScanStatus: scans[0]?.status ?? null,
        openFindings: _count.findings,
      })),
    };
  }
}
