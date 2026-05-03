import { Global, Module } from '@nestjs/common';
import { RequestContextService } from '../context/request-context.service';
import { SecretCryptoService } from './secret-crypto.service';

@Global()
@Module({
  providers: [SecretCryptoService, RequestContextService],
  exports: [SecretCryptoService, RequestContextService],
})
export class SecurityModule {}
