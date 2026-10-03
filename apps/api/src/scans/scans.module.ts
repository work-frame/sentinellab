import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TargetsModule } from '../targets/targets.module';
import { SCAN_QUEUE } from './scans.constants';
import { ScanRunnerService } from './scan-runner.service';
import { ScansController } from './scans.controller';
import { ScansProcessor } from './scans.processor';
import { ScansService } from './scans.service';

@Module({
  imports: [BullModule.registerQueue({ name: SCAN_QUEUE }), TargetsModule],
  controllers: [ScansController],
  providers: [ScansService, ScanRunnerService, ScansProcessor],
  exports: [ScansService],
})
export class ScansModule {}
