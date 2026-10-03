import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, Res, StreamableFile } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators';
import { PaginationQuery } from '../common/pagination.dto';
import { clientInfo, type AuthUser } from '../common/request-context';
import { GenerateReportDto } from './reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiCookieAuth('session')
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('scans/:scanId/reports')
  @ApiOperation({ summary: 'Generate a report for a completed scan.' })
  generate(@CurrentUser() user: AuthUser, @Param('scanId', ParseUUIDPipe) scanId: string, @Body() dto: GenerateReportDto, @Req() req: Request) {
    return this.reports.generate(scanId, dto.format, user, clientInfo(req));
  }

  @Get('reports')
  @ApiOperation({ summary: 'List generated reports.' })
  list(@CurrentUser() user: AuthUser, @Query() q: PaginationQuery) {
    return this.reports.list(user, q);
  }

  @Get('reports/:id/download')
  @ApiProduces('text/markdown', 'text/html')
  @ApiOperation({ summary: 'Download a report as an attachment.' })
  async download(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const report = await this.reports.getContent(id, user);
    const html = report.format === 'HTML';
    res.set({
      'Content-Type': html ? 'text/html; charset=utf-8' : 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="sentinellab-report-${report.id}.${html ? 'html' : 'md'}"`,
      // The HTML report needs inline styles only; block every script.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
    });
    return new StreamableFile(Buffer.from(report.content, 'utf8'));
  }
}
