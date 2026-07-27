import { Global, Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AutoFixService } from './auto-fix.service';

@Global()
@Module({
  providers: [AiService, AutoFixService],
  exports: [AiService, AutoFixService],
})
export class AiModule {}
