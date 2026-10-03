import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export class GenerateReportDto {
  @ApiProperty({ enum: ['MARKDOWN', 'HTML'] })
  @IsIn(['MARKDOWN', 'HTML'])
  format: 'MARKDOWN' | 'HTML';
}
