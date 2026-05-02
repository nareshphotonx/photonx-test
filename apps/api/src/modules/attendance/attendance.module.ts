import { Module } from '@nestjs/common';
import { RequestCodeService } from '../../common/services/request-code.service';
import { ApprovalsModule } from '../approvals/approvals.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [ApprovalsModule],
  controllers: [AttendanceController],
  providers: [AttendanceService, RequestCodeService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
