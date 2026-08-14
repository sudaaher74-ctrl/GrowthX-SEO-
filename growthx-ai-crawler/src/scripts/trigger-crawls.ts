import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CrawlerService } from '../modules/crawler/crawler.service';
import { AiVisibilityService } from '../modules/ai-visibility/ai-visibility.service';
import { PrismaService } from '../database/prisma.service';

async function main() {
  console.log('Bootstrapping NestJS context for real data triggers...');
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const prisma = app.get(PrismaService);
  const crawler = app.get(CrawlerService);
  const aiVisibility = app.get(AiVisibilityService);

  const website = await prisma.website.findUnique({ where: { domain: 'milquufresh.in' } });
  if (!website) {
    console.error('milquufresh.in not found');
    process.exit(1);
  }
  
  console.log('Triggering high-concurrency crawl job for milquufresh.in...');
  try {
    const jobId = await crawler.startCrawlJob(website.id, { maxConcurrency: 5, maxDepth: 2, useSitemap: false });
    console.log(`Crawl Job Dispatched: ${jobId}`);
  } catch (err: any) {
    console.log(`Crawl Job error (might be rate limited or already running): ${err.message}`);
  }

  const project = await prisma.project.findFirst({ where: { name: 'Milquufresh SEO' } });
  if (project) {
    console.log('Triggering AI Visibility Sweep for Milquufresh SEO project...');
    try {
      await aiVisibility.sweepProject(project.id);
      console.log('AI Visibility Sweep Dispatched successfully.');
    } catch (err: any) {
      console.log(`Sweep Error: ${err.message}`);
    }
  }

  await app.close();
}

main().catch(console.error);
