import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UnlockTimeEntryDto {
  @ApiProperty({ example: 'Payroll correction approved' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
