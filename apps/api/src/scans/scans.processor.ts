import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { SCAN_QUEUE, type ScanJobData } from './scans.constants';
import { ScanRunnerService } from './scan-runner.service';

/** BullMQ worker. Runs in the API process; up to two scans at a time. */
@Processor(SCAN_QUEUE, { concurrency: 2 })
export class ScansProcessor extends WorkerHost {
  constructor(private readonly runner: ScanRunnerService) {
    super();
  }

  async process(job: Job<ScanJobData>): Promise<void> {
    await this.runner.run(job.data.scanId);
  }
}
