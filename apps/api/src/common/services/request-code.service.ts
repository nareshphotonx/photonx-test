import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type TxLike = PrismaService;

type RequestCodeEntity = 'leave' | 'wfh' | 'expense' | 'attendance_regularization';

@Injectable()
export class RequestCodeService {
  constructor(private readonly prisma: PrismaService) {}

  async next(tenantId: string, entity: RequestCodeEntity, tx?: TxLike): Promise<number> {
    const client = tx ?? this.prisma;

    if (entity === 'leave') {
      const max = await client.leaveRequest.aggregate({
        where: { tenantId },
        _max: { requestCode: true },
      });
      return (max._max.requestCode ?? 0) + 1;
    }

    if (entity === 'wfh') {
      const max = await client.wfhRequest.aggregate({
        where: { tenantId },
        _max: { requestCode: true },
      });
      return (max._max.requestCode ?? 0) + 1;
    }

    if (entity === 'expense') {
      const max = await client.expense.aggregate({
        where: { tenantId },
        _max: { requestCode: true },
      });
      return (max._max.requestCode ?? 0) + 1;
    }

    const max = await client.attendanceRegularizationRequest.aggregate({
      where: { tenantId },
      _max: { requestCode: true },
    });
    return (max._max.requestCode ?? 0) + 1;
  }
}
