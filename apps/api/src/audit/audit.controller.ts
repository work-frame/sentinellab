import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators';
import { PaginationQuery, paginated } from '../common/pagination.dto';
import type { AuthUser } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('audit')
@ApiCookieAuth('session')
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'List audit log entries. Members see their own; admins see all.' })
  async list(@CurrentUser() user: AuthUser, @Query() q: PaginationQuery) {
    const where = user.role === 'ADMIN' ? {} : { actorId: user.id };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: q.skip,
        take: q.pageSize,
        include: { actor: { select: { email: true, name: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(items, total, q);
  }
}
