import { Module } from '@nestjs/common';
import { RequestCodeService } from '../../common/services/request-code.service';
import { ApprovalsModule } from '../approvals/approvals.module';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [ApprovalsModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, RequestCodeService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
