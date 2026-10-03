import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import type { AuthUser, ClientInfo } from '../common/request-context';
import { paginated, type PaginationQuery } from '../common/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { renderHtml, renderMarkdown } from './report-renderer';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async generate(scanId: string, format: 'MARKDOWN' | 'HTML', user: AuthUser, client: ClientInfo) {
    const scan = await this.prisma.scan.findFirst({
      where: { id: scanId, target: { ownerId: user.id } },
      include: {
        target: true,
        modules: { orderBy: { position: 'asc' } },
        findings: { include: { evidence: true }, orderBy: [{ severity: 'asc' }, { title: 'asc' }] },
      },
    });
    if (!scan) throw new NotFoundException('Scan not found');
    if (scan.status !== 'COMPLETED') throw new BadRequestException('Reports can only be generated for completed scans');

    const generatedAt = new Date();
    const title = `Security assessment: ${scan.target.name}`;
    const reportData = {
      title,
      generatedAt,
      generatedBy: user.name,
      target: scan.target,
      scan: { ...scan, modules: scan.modules },
      findings: scan.findings,
    };
    const content = format === 'HTML' ? renderHtml(reportData) : renderMarkdown(reportData);
    const report = await this.prisma.report.create({
      data: { scanId, generatedById: user.id, title, format, content },
      select: { id: true, title: true, format: true, createdAt: true, scanId: true },
    });
    await this.audit.record({
      action: 'report.generated',
      actorId: user.id,
      resourceType: 'report',
      resourceId: report.id,
      client,
      metadata: { scanId, format },
    });
    return report;
  }

  async list(user: AuthUser, q: PaginationQuery) {
    const where = { scan: { target: { ownerId: user.id } } };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
        select: {
          id: true,
          title: true,
          format: true,
          createdAt: true,
          scan: { select: { id: true, finishedAt: true, target: { select: { id: true, name: true } } } },
          generatedBy: { select: { name: true } },
        },
      }),
      this.prisma.report.count({ where }),
    ]);
    return paginated(items, total, q);
  }

  async getContent(id: string, user: AuthUser) {
    const report = await this.prisma.report.findFirst({ where: { id, scan: { target: { ownerId: user.id } } } });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }
}
