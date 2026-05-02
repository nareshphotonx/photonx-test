import { Module } from '@nestjs/common';
import { RequestCodeService } from '../../common/services/request-code.service';
import { ApprovalsModule } from '../approvals/approvals.module';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';

@Module({
  imports: [ApprovalsModule],
  controllers: [LeaveController],
  providers: [LeaveService, RequestCodeService],
  exports: [LeaveService],
})
export class LeaveModule {}
