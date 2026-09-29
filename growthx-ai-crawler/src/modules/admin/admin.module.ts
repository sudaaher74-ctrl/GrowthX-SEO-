import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PlatformAdminGuard } from './platform-admin.guard';
import { TokensModule } from '../tokens/tokens.module';

@Module({
  imports: [TokensModule],
  controllers: [AdminController],
  providers: [AdminService, PlatformAdminGuard],
})
export class AdminModule {}
