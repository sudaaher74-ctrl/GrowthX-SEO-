import { Global, Module } from '@nestjs/common';
import { HtmlExtractorService } from './html-extractor.service';

@Global()
@Module({
  providers: [HtmlExtractorService],
  exports: [HtmlExtractorService],
})
export class ExtractorModule {}
