import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [PlatformAdminService, PlatformAdminGuard],
  exports: [PlatformAdminService, PlatformAdminGuard],
})
export class PlatformAdminModule {}
