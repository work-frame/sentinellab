import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Queue } from 'bullmq';
import { Public } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { SCAN_QUEUE } from '../scans/scans.constants';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SCAN_QUEUE) private readonly queue: Queue,
  ) {}

  @Public()
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'Liveness and dependency check. Returns 503 if Postgres or Redis is down.' })
  async check() {
    const [db, redis] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => 'up').catch(() => 'down'),
      this.queue.client.then((c) => (c as unknown as { ping(): Promise<string> }).ping()).then(() => 'up').catch(() => 'down'),
    ]);
    const body = { status: db === 'up' && redis === 'up' ? 'ok' : 'degraded', database: db, redis };
    if (body.status !== 'ok') throw new ServiceUnavailableException(body);
    return body;
  }
}
