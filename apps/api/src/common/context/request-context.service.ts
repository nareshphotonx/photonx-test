import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContextState {
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class RequestContextService {
  private readonly storage = new AsyncLocalStorage<RequestContextState>();

  run<T>(context: RequestContextState, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  get(): RequestContextState | undefined {
    return this.storage.getStore();
  }
}
