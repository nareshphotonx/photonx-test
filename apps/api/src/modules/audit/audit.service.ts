import { Injectable } from '@nestjs/common';

export interface AuditLogInput {
  tenantId?: string;
  actorId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  async log(input: AuditLogInput): Promise<void> {
    // Foundation skeleton. Persistence wiring will be added with business modules.
    void input;
  }
}
