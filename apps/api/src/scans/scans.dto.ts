import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { SCAN_STATUSES } from '@sentinellab/types';
import { PaginationQuery } from '../common/pagination.dto';

export class ListScansQuery extends PaginationQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @ApiPropertyOptional({ enum: SCAN_STATUSES })
  @IsOptional()
  @IsIn(SCAN_STATUSES)
  status?: (typeof SCAN_STATUSES)[number];
}
