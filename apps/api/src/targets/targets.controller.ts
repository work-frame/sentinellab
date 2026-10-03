import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators';
import { clientInfo, type AuthUser } from '../common/request-context';
import { AuthorizeTargetDto, CreateTargetDto, ListTargetsQuery, UpdateTargetDto } from './targets.dto';
import { TargetsService } from './targets.service';

@ApiTags('targets')
@ApiCookieAuth('session')
@Controller('targets')
export class TargetsController {
  constructor(private readonly targets: TargetsService) {}

  @Get()
  @ApiOperation({ summary: 'List your targets with their last scan and open finding count.' })
  list(@CurrentUser() user: AuthUser, @Query() q: ListTargetsQuery) {
    return this.targets.list(user, q);
  }

  @Post()
  @ApiOperation({ summary: 'Register a target. The URL must resolve to a public address or a configured demo target.' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTargetDto, @Req() req: Request) {
    return this.targets.create(dto, user, clientInfo(req));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Target details.' })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.targets.get(id, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit, disable or enable a target. A new URL clears the authorization confirmation.' })
  update(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTargetDto, @Req() req: Request) {
    return this.targets.update(id, dto, user, clientInfo(req));
  }

  @Post(':id/authorize')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirm you are authorized to test this target. Required before scanning.' })
  authorize(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AuthorizeTargetDto, @Req() req: Request) {
    return this.targets.authorize(id, dto, user, clientInfo(req));
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a target with its scans, findings and reports.' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.targets.remove(id, user, clientInfo(req));
  }
}
