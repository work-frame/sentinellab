import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators';
import { clientInfo, type AuthUser } from '../common/request-context';
import { ListScansQuery } from './scans.dto';
import { ScansService } from './scans.service';

@ApiTags('scans')
@ApiCookieAuth('session')
@Controller()
export class ScansController {
  constructor(private readonly scans: ScansService) {}

  @Post('targets/:targetId/scans')
  @HttpCode(202)
  @ApiOperation({ summary: 'Queue a scan. The target must be enabled and authorized, with no other active scan.' })
  start(@CurrentUser() user: AuthUser, @Param('targetId', ParseUUIDPipe) targetId: string, @Req() req: Request) {
    return this.scans.start(targetId, user, clientInfo(req));
  }

  @Get('scans')
  @ApiOperation({ summary: 'Scan history, newest first.' })
  list(@CurrentUser() user: AuthUser, @Query() q: ListScansQuery) {
    return this.scans.list(user, q);
  }

  @Get('scans/:id')
  @ApiOperation({ summary: 'Scan details with module progress and severity counts.' })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.scans.get(id, user);
  }

  @Post('scans/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a queued or running scan.' })
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.scans.cancel(id, user, clientInfo(req));
  }
}
