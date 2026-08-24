import { Global, Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AutoFixService } from './auto-fix.service';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { AiEngineModule } from '../ai-engine/ai-engine.module';

@Global()
@Module({
  imports: [AiSearchModule, AiEngineModule],
  providers: [AiService, AutoFixService],
  exports: [AiService, AutoFixService, AiEngineModule],
})
export class AiModule {}
