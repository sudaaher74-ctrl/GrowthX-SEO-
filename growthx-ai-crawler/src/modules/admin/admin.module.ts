import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PlatformAdminModule } from './platform-admin.module';
import { TokensModule } from '../tokens/tokens.module';
import { AiSearchModule } from '../ai-search/ai-search.module';

@Module({
  imports: [TokensModule, PlatformAdminModule, AiSearchModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
