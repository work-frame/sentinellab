import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Equals, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { APP_CONFIG, type AppConfig } from '../config/env';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../common/decorators';
import { clientInfo, type AuthUser } from '../common/request-context';
import { PrismaService } from '../prisma/prisma.service';

export const DEMO_WARNING = 'INTENTIONALLY VULNERABLE — LOCAL SECURITY TRAINING TARGET';

class RegisterDemoDto {
  @ApiProperty({ example: true, description: 'Confirms you understand this is a local, intentionally vulnerable target you run yourself.' })
  @Equals(true, { message: 'You must acknowledge the demo target before adding it' })
  acknowledge: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

@ApiTags('demo')
@ApiCookieAuth('session')
@Controller('demo/targets')
export class DemoController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Predefined local demo targets from DEMO_TARGETS, and whether you already added each one.' })
  async list(@CurrentUser() user: AuthUser) {
    const existing = await this.prisma.target.findMany({
      where: { ownerId: user.id, isDemo: true },
      select: { id: true, baseUrl: true },
    });
    return this.config.demoTargets.map((d) => ({
      ...d,
      warning: DEMO_WARNING,
      targetId: existing.find((t) => t.baseUrl === d.baseUrl)?.id ?? null,
    }));
  }

  @Post(':key')
  @ApiOperation({ summary: 'Add a predefined demo target to your targets, already authorized.' })
  async register(@CurrentUser() user: AuthUser, @Param('key') key: string, @Body() dto: RegisterDemoDto, @Req() req: Request) {
    const demo = this.config.demoTargets.find((d) => d.key === key);
    if (!demo) throw new NotFoundException('Unknown demo target');
    const existing = await this.prisma.target.findFirst({ where: { ownerId: user.id, isDemo: true, baseUrl: demo.baseUrl } });
    if (existing) return existing;
    const target = await this.prisma.target.create({
      data: {
        ownerId: user.id,
        name: dto.name?.trim() || demo.name,
        description: `${DEMO_WARNING}. ${demo.description}`,
        baseUrl: demo.baseUrl,
        environment: 'LOCAL_DEMO',
        isDemo: true,
        authorizationConfirmedAt: new Date(),
        authorizationNote: 'Local demo target acknowledged in the Demo Lab.',
      },
    });
    await this.audit.record({
      action: 'target.created',
      actorId: user.id,
      resourceType: 'target',
      resourceId: target.id,
      client: clientInfo(req),
      metadata: { demo: key, baseUrl: demo.baseUrl, authorized: true },
    });
    return target;
  }
}
