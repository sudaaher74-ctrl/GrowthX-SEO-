import { Global, Module } from '@nestjs/common';
import { SitemapService } from './sitemap.service';

@Global()
@Module({
  providers: [SitemapService],
  exports: [SitemapService],
})
export class SitemapModule {}
