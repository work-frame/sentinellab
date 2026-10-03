import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { Equals, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationQuery } from '../common/pagination.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
/** LOCAL_DEMO is reserved for targets created through the Demo Lab. */
export const USER_ENVIRONMENTS = ['DEVELOPMENT', 'STAGING', 'PRODUCTION'] as const;

export class CreateTargetDto {
  @ApiProperty({ example: 'Staging storefront' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ example: 'https://staging.example.com/', description: 'http or https. Internal addresses are refused.' })
  @Transform(trim)
  @IsString()
  @MaxLength(2048)
  baseUrl: string;

  @ApiProperty({ enum: USER_ENVIRONMENTS })
  @IsIn(USER_ENVIRONMENTS)
  environment: (typeof USER_ENVIRONMENTS)[number];

  @ApiPropertyOptional({ description: 'Set to true to confirm you own or have written permission to test this target.' })
  @IsOptional()
  @IsBoolean()
  authorizationConfirmed?: boolean;

  @ApiPropertyOptional({ description: 'Who granted permission, ticket number, scope notes.', maxLength: 500 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  authorizationNote?: string;
}

export class UpdateTargetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Changing the URL clears the authorization confirmation.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2048)
  baseUrl?: string;

  @ApiPropertyOptional({ enum: USER_ENVIRONMENTS })
  @IsOptional()
  @IsIn(USER_ENVIRONMENTS)
  environment?: (typeof USER_ENVIRONMENTS)[number];

  @ApiPropertyOptional({ description: 'false disables scanning for this target.' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class AuthorizeTargetDto {
  @ApiProperty({ description: 'Must be true.', example: true })
  @Equals(true, { message: 'You must confirm that you are authorized to test this target' })
  confirm: boolean;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListTargetsQuery extends PaginationQuery {
  @ApiPropertyOptional({ description: 'Search name and URL' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({ enum: ['LOCAL_DEMO', ...USER_ENVIRONMENTS] })
  @IsOptional()
  @IsIn(['LOCAL_DEMO', ...USER_ENVIRONMENTS])
  environment?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => String)
  @IsIn(['true', 'false'])
  enabled?: string;
}
