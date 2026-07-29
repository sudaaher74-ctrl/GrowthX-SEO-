import { Module } from '@nestjs/common';
import { AeoAnalysisService } from './aeo-analysis/aeo-analysis.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [AeoAnalysisService],
  exports: [AeoAnalysisService]
})
export class AiVisibilityModule {}
