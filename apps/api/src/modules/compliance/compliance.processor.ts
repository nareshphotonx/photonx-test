import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ComplianceService } from './compliance.service';

interface ComplianceJob {
  requestId: string;
}

@Injectable()
@Processor('compliance-requests')
export class ComplianceProcessor extends WorkerHost {
  private readonly logger = new Logger(ComplianceProcessor.name);

  constructor(private readonly complianceService: ComplianceService) {
    super();
  }

  async process(job: Job<ComplianceJob>): Promise<void> {
    if (job.name !== 'compliance-request') {
      return;
    }

    try {
      await this.complianceService.processRequest(job.data.requestId);
    } catch (error) {
      this.logger.error('Failed compliance request processing', error as Error);
      throw error;
    }
  }
}
