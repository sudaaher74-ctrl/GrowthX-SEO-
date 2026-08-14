import { Controller, Get } from '@nestjs/common';

import { CrawlerService } from './modules/crawler/crawler.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Controller('health')
export class HealthController {
  constructor(private readonly crawlerService: CrawlerService) {}

  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'growthx-crawler-api',
    };
  }

  @Get('trigger-crawl')
  async triggerTestCrawl() {
    const website = await prisma.website.findUnique({
      where: { domain: 'milquufresh.in' }
    });
    if (!website) return { error: 'Website not found' };
    
    const job = await this.crawlerService.startCrawlJob(website.id, {
      maxConcurrency: 5,
      maxDepth: 3,
      useSitemap: true
    });
    return { job };
  }
}
