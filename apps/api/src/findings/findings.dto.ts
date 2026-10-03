import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { FINDING_STATUSES, SEVERITIES } from '@sentinellab/types';
import { PaginationQuery } from '../common/pagination.dto';

export class ListFindingsQuery extends PaginationQuery {
  @ApiPropertyOptional({ enum: SEVERITIES })
  @IsOptional()
  @IsIn(SEVERITIES)
  severity?: (typeof SEVERITIES)[number];

  @ApiPropertyOptional({ enum: FINDING_STATUSES })
  @IsOptional()
  @IsIn(FINDING_STATUSES)
  status?: (typeof FINDING_STATUSES)[number];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  scanId?: string;

  @ApiPropertyOptional({ description: 'Search title, type and endpoint' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class UpdateFindingStatusDto {
  @ApiProperty({ enum: FINDING_STATUSES })
  @IsIn(FINDING_STATUSES)
  status: (typeof FINDING_STATUSES)[number];

  @ApiPropertyOptional({ maxLength: 1000, description: 'Why the status changed.' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  note?: string;
}
