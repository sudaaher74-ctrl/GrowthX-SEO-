import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ObservabilityModule } from './modules/observability/observability.module';
import { DatabaseModule } from './database/database.module';
import { StorageModule } from './storage/storage.module';
import { SecurityModule } from './modules/security/security.module';
import { ValidatorModule } from './modules/validator/validator.module';
import { RobotsModule } from './modules/robots/robots.module';
import { SitemapModule } from './modules/sitemap/sitemap.module';
import { QueueModule } from './modules/queue/queue.module';
import { CrawlerModule } from './modules/crawler/crawler.module';
import { ExtractorModule } from './modules/extractor/extractor.module';
import { AnalyzerModule } from './modules/analyzer/analyzer.module';
import { PerformanceModule } from './modules/performance/performance.module';
import { IssuesModule } from './modules/issues/issues.module';
import { GraphModule } from './modules/graph/graph.module';
import { AiModule } from './modules/ai/ai.module';
import { HistoryModule } from './modules/history/history.module';
import { CrawlerSchedulerModule } from './modules/scheduler/scheduler.module';
import { SocketModule } from './modules/socket/socket.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ObservabilityModule,
    DatabaseModule,
    StorageModule,
    SecurityModule,
    ValidatorModule,
    RobotsModule,
    SitemapModule,
    QueueModule,
    ExtractorModule,
    AnalyzerModule,
    PerformanceModule,
    IssuesModule,
    GraphModule,
    AiModule,
    HistoryModule,
    CrawlerSchedulerModule,
    SocketModule,
    CrawlerModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
