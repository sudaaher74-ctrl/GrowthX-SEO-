import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { StorageModule } from '../../storage/storage.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { DesignStudioController } from './design-studio.controller';
import { DesignStudioService } from './design-studio.service';
import { SlotExtractorService } from './slot-extractor.service';

@Module({
  imports: [DatabaseModule, StorageModule, AiSearchModule],
  controllers: [DesignStudioController],
  providers: [DesignStudioService, SlotExtractorService],
  exports: [DesignStudioService, SlotExtractorService],
})
export class DesignStudioModule {}
