import { Global, Module } from '@nestjs/common';
import { SecurityService } from './security.service';
import { OAuthTransactionService } from './oauth-transaction.service';

@Global()
@Module({
  providers: [SecurityService, OAuthTransactionService],
  exports: [SecurityService, OAuthTransactionService],
})
export class SecurityModule {}
