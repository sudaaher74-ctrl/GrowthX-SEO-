import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AiSearchModule } from '../ai-search/ai-search.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { ContentIdeasService } from './content-ideas.service';

/** Keyword and blog-post suggestions, shared by every report that is written by AI, with Google's real numbers where there are any. */
@Module({
  // IntegrationsModule for the Search Console numbers behind the ideas.
  imports: [DatabaseModule, AiSearchModule, IntegrationsModule],
  providers: [ContentIdeasService],
  exports: [ContentIdeasService],
})
export class ContentIdeasModule {}
