import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class GetUserLeaveBalanceToolInput {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export class ApplyLeaveToolInput {
  @IsString()
  leaveTypeId!: string;

  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  @IsString()
  @MaxLength(1000)
  reason!: string;
}

export class ApplyWfhToolInput {
  @Type(() => Date)
  @IsDate()
  requestDate!: Date;

  @IsString()
  @MaxLength(1000)
  reason!: string;
}

export class ListMyTasksToolInput {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  statusId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class UpdateTaskStatusToolInput {
  @IsString()
  taskId!: string;

  @IsString()
  statusId!: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  locationLatitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  locationLongitude?: number;

  @IsOptional()
  @IsString()
  selfieAttachmentId?: string;
}

export class LogTaskHoursToolInput {
  @IsString()
  projectId!: string;

  @IsOptional()
  @IsString()
  taskId?: string;

  @Type(() => Date)
  @IsDate()
  entryDate!: Date;

  @IsNumber()
  @Min(0.25)
  hours!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class GetUserPerformanceToolInput {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  days?: number;
}

export class GetProjectBurnToolInput {
  @IsString()
  projectId!: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}

export class ListPendingApprovalsToolInput {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class WhoIsOnLeaveTodayToolInput {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date?: Date;
}

export class FileExpenseToolInput {
  @IsString()
  projectId!: string;

  @IsString()
  categoryId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @MaxLength(10)
  currency!: string;

  @Type(() => Date)
  @IsDate()
  expenseDate!: Date;

  @IsString()
  @MaxLength(1000)
  description!: string;

  @IsOptional()
  @IsString()
  receiptAttachmentId?: string;
}

export class CheckInToolInput {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  occurredAt?: Date;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class CheckOutToolInput {
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  occurredAt?: Date;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}
