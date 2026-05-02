import { Module } from '@nestjs/common';
import { RequestCodeService } from '../../common/services/request-code.service';
import { ApprovalsModule } from '../approvals/approvals.module';
import { WfhController } from './wfh.controller';
import { WfhService } from './wfh.service';

@Module({
  imports: [ApprovalsModule],
  controllers: [WfhController],
  providers: [WfhService, RequestCodeService],
  exports: [WfhService],
})
export class WfhModule {}
