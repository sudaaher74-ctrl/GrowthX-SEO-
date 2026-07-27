import { Global, Module } from '@nestjs/common';
import { SecurityService } from './security.service';
import { AuthGuard } from './auth.guard';

@Global()
@Module({
  providers: [SecurityService, AuthGuard],
  exports: [SecurityService, AuthGuard],
})
export class SecurityModule {}
