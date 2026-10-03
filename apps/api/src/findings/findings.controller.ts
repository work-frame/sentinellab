import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators';
import { clientInfo, type AuthUser } from '../common/request-context';
import { ListFindingsQuery, UpdateFindingStatusDto } from './findings.dto';
import { FindingsService } from './findings.service';

@ApiTags('findings')
@ApiCookieAuth('session')
@Controller('findings')
export class FindingsController {
  constructor(private readonly findings: FindingsService) {}

  @Get()
  @ApiOperation({ summary: 'Search and filter findings across your targets, most severe first.' })
  list(@CurrentUser() user: AuthUser, @Query() q: ListFindingsQuery) {
    return this.findings.list(user, q);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Finding details with redacted evidence.' })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.findings.get(id, user);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change the triage status of a finding.' })
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFindingStatusDto,
    @Req() req: Request,
  ) {
    return this.findings.updateStatus(id, dto, user, clientInfo(req));
  }
}
