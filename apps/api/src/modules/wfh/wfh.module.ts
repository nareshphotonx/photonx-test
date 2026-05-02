import { Module } from '@nestjs/common';
import { ApprovalsModule } from '../approvals/approvals.module';
import { WfhController } from './wfh.controller';
import { WfhService } from './wfh.service';

@Module({
  imports: [ApprovalsModule],
  controllers: [WfhController],
  providers: [WfhService],
  exports: [WfhService],
})
export class WfhModule {}
