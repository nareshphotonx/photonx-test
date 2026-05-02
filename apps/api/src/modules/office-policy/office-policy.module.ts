import { Module } from '@nestjs/common';
import { OfficePolicyController } from './office-policy.controller';
import { OfficePolicyService } from './office-policy.service';

@Module({
  controllers: [OfficePolicyController],
  providers: [OfficePolicyService],
})
export class OfficePolicyModule {}
