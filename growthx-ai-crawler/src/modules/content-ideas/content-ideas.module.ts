import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { ContentIdeasService } from './content-ideas.service';

/** Keyword and blog-post suggestions, shared by every report that is written by AI. */
@Module({
  imports: [DatabaseModule, AiSearchModule],
  providers: [ContentIdeasService],
  exports: [ContentIdeasService],
})
export class ContentIdeasModule {}
