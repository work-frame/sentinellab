import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SCAN_QUEUE } from '../scans/scans.constants';
import { HealthController } from './health.controller';

@Module({ imports: [BullModule.registerQueue({ name: SCAN_QUEUE })], controllers: [HealthController] })
export class HealthModule {}
