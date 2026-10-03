import { Controller, Get } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators';
import type { AuthUser } from '../common/request-context';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiCookieAuth('session')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Scan and finding statistics, recent activity and target health for the signed-in user.' })
  summary(@CurrentUser() user: AuthUser) {
    return this.dashboard.summary(user);
  }
}
