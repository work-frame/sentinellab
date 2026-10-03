import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthUser, ClientInfo } from '../common/request-context';
import { paginated } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { ListFindingsQuery, UpdateFindingStatusDto } from './findings.dto';


@Injectable()
export class FindingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: AuthUser, q: ListFindingsQuery) {
    const where: Prisma.FindingWhereInput = { target: { ownerId: user.id } };
    if (q.severity) where.severity = q.severity;
    if (q.status) where.status = q.status;
    if (q.targetId) where.targetId = q.targetId;
    if (q.scanId) where.scanId = q.scanId;
    if (q.q) {
      where.OR = ['title', 'type', 'endpoint'].map((field) => ({ [field]: { contains: q.q, mode: 'insensitive' } }));
    }
    // Prisma sorts enums by declaration order, which is CRITICAL first.
    const [items, total] = await this.prisma.$transaction([
      this.prisma.finding.findMany({
        where,
        orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
        skip: q.skip,
        take: q.pageSize,
        select: {
          id: true,
          title: true,
          type: true,
          severity: true,
          confidence: true,
          status: true,
          endpoint: true,
          method: true,
          module: true,
          createdAt: true,
          scanId: true,
          target: { select: { id: true, name: true } },
        },
      }),
      this.prisma.finding.count({ where }),
    ]);
    return paginated(items, total, q);
  }

  async get(id: string, user: AuthUser) {
    const finding = await this.prisma.finding.findFirst({
      where: { id, target: { ownerId: user.id } },
      include: {
        evidence: { orderBy: { createdAt: 'asc' } },
        target: { select: { id: true, name: true, baseUrl: true, environment: true, isDemo: true } },
        scan: { select: { id: true, status: true, queuedAt: true, finishedAt: true } },
      },
    });
    if (!finding) throw new NotFoundException('Finding not found');
    return finding;
  }

  async updateStatus(id: string, dto: UpdateFindingStatusDto, user: AuthUser, client: ClientInfo) {
    const existing = await this.get(id, user);
    const finding = await this.prisma.finding.update({
      where: { id },
      data: { status: dto.status, statusNote: dto.note || null, statusChangedAt: new Date() },
    });
    await this.audit.record({
      action: 'finding.status_changed',
      actorId: user.id,
      resourceType: 'finding',
      resourceId: id,
      client,
      metadata: { from: existing.status, to: dto.status },
    });
    return finding;
  }
}

