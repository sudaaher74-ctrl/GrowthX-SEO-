import { Global, Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AutoFixService } from './auto-fix.service';
import { AiSearchModule } from '../ai-search/ai-search.module';

@Global()
@Module({
  imports: [AiSearchModule],
  providers: [AiService, AutoFixService],
  exports: [AiService, AutoFixService],
})
export class AiModule {}
