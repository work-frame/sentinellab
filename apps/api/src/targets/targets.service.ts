import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma, Target } from '@prisma/client';
import { assertUrlAllowed, TargetPolicyError } from '@sentinellab/security-engine';
import { APP_CONFIG, type AppConfig } from '../config/env';
import { AuditService } from '../audit/audit.service';
import type { AuthUser, ClientInfo } from '../common/request-context';
import { paginated } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthorizeTargetDto, CreateTargetDto, ListTargetsQuery, UpdateTargetDto } from './targets.dto';

const ACTIVE_SCAN: Prisma.ScanWhereInput = { status: { in: ['QUEUED', 'RUNNING'] } };
const OPEN_FINDING: Prisma.FindingWhereInput = { status: { in: ['OPEN', 'CONFIRMED'] } };

@Injectable()
export class TargetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  /** Normalize and validate a URL against the SSRF policy. */
  async validateUrl(raw: string): Promise<string> {
    try {
      const url = await assertUrlAllowed(raw, this.config.targetPolicy);
      return url.toString();
    } catch (err) {
      if (err instanceof TargetPolicyError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  /**
   * Every lookup is scoped to the owner. A target that exists but belongs to
   * someone else returns 404, the same as one that does not exist.
   */
  async findOwned(id: string, user: AuthUser): Promise<Target> {
    const target = await this.prisma.target.findFirst({ where: { id, ownerId: user.id } });
    if (!target) throw new NotFoundException('Target not found');
    return target;
  }

  async list(user: AuthUser, q: ListTargetsQuery) {
    const where: Prisma.TargetWhereInput = { ownerId: user.id };
    if (q.q) where.OR = [{ name: { contains: q.q, mode: 'insensitive' } }, { baseUrl: { contains: q.q, mode: 'insensitive' } }];
    if (q.environment) where.environment = q.environment as Target['environment'];
    if (q.enabled) where.enabled = q.enabled === 'true';

    const [items, total] = await this.prisma.$transaction([
      this.prisma.target.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
        include: {
          scans: { orderBy: { queuedAt: 'desc' }, take: 1, select: { id: true, status: true, queuedAt: true, finishedAt: true } },
          _count: { select: { findings: { where: OPEN_FINDING } } },
        },
      }),
      this.prisma.target.count({ where }),
    ]);
    return paginated(
      items.map(({ scans, _count, ...t }) => ({ ...t, lastScan: scans[0] ?? null, openFindings: _count.findings })),
      total,
      q,
    );
  }

  async get(id: string, user: AuthUser) {
    const target = await this.findOwned(id, user);
    const [lastScan, severityCounts] = await Promise.all([
      this.prisma.scan.findFirst({ where: { targetId: id }, orderBy: { queuedAt: 'desc' } }),
      this.prisma.finding.groupBy({ by: ['severity'], where: { targetId: id, ...OPEN_FINDING }, _count: true }),
    ]);
    return {
      ...target,
      lastScan,
      openFindingsBySeverity: Object.fromEntries(severityCounts.map((c) => [c.severity, c._count])),
    };
  }

  async create(dto: CreateTargetDto, user: AuthUser, client: ClientInfo) {
    const baseUrl = await this.validateUrl(dto.baseUrl);
    const target = await this.prisma.target.create({
      data: {
        ownerId: user.id,
        name: dto.name,
        description: dto.description || null,
        baseUrl,
        environment: dto.environment,
        authorizationConfirmedAt: dto.authorizationConfirmed ? new Date() : null,
        authorizationNote: dto.authorizationConfirmed ? dto.authorizationNote || null : null,
      },
    });
    await this.audit.record({
      action: 'target.created',
      actorId: user.id,
      resourceType: 'target',
      resourceId: target.id,
      client,
      metadata: { name: target.name, baseUrl, authorized: Boolean(dto.authorizationConfirmed) },
    });
    return target;
  }

  async update(id: string, dto: UpdateTargetDto, user: AuthUser, client: ClientInfo) {
    const existing = await this.findOwned(id, user);
    if (existing.isDemo && (dto.baseUrl !== undefined || dto.environment !== undefined)) {
      throw new BadRequestException('The URL and environment of a demo target cannot be changed');
    }
    const data: Prisma.TargetUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description || null;
    if (dto.environment !== undefined) data.environment = dto.environment;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.baseUrl !== undefined) {
      const baseUrl = await this.validateUrl(dto.baseUrl);
      if (baseUrl !== existing.baseUrl) {
        data.baseUrl = baseUrl;
        // Permission was given for the old URL, not the new one.
        data.authorizationConfirmedAt = null;
        data.authorizationNote = null;
      }
    }
    const target = await this.prisma.target.update({ where: { id: existing.id }, data });

    const action =
      dto.enabled === false && existing.enabled ? 'target.disabled' : dto.enabled === true && !existing.enabled ? 'target.enabled' : 'target.updated';
    await this.audit.record({
      action,
      actorId: user.id,
      resourceType: 'target',
      resourceId: id,
      client,
      metadata: { changed: Object.keys(data), authorizationCleared: data.authorizationConfirmedAt === null },
    });
    return target;
  }

  async authorize(id: string, dto: AuthorizeTargetDto, user: AuthUser, client: ClientInfo) {
    await this.findOwned(id, user);
    const target = await this.prisma.target.update({
      where: { id },
      data: { authorizationConfirmedAt: new Date(), authorizationNote: dto.note || null },
    });
    await this.audit.record({ action: 'target.authorized', actorId: user.id, resourceType: 'target', resourceId: id, client });
    return target;
  }

  async remove(id: string, user: AuthUser, client: ClientInfo) {
    const target = await this.findOwned(id, user);
    const active = await this.prisma.scan.count({ where: { targetId: id, ...ACTIVE_SCAN } });
    if (active > 0) throw new ConflictException('Cancel the active scan before deleting this target');
    await this.prisma.target.delete({ where: { id } });
    await this.audit.record({
      action: 'target.deleted',
      actorId: user.id,
      resourceType: 'target',
      resourceId: id,
      client,
      metadata: { name: target.name, baseUrl: target.baseUrl },
    });
  }
}
