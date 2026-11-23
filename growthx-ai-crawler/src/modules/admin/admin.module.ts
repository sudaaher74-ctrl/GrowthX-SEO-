import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PlatformAdminModule } from './platform-admin.module';
import { TokensModule } from '../tokens/tokens.module';

@Module({
  imports: [TokensModule, PlatformAdminModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
