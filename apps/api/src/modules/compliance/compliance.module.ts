import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller';
import { ComplianceProcessor } from './compliance.processor';
import { ComplianceService } from './compliance.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'compliance-requests',
    }),
  ],
  controllers: [ComplianceController],
  providers: [ComplianceService, ComplianceProcessor],
})
export class ComplianceModule {}
