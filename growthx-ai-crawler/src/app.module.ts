import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ObservabilityModule } from './modules/observability/observability.module';
import { DatabaseModule } from './database/database.module';
import { AgentsModule } from './modules/agents/agents.module';
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
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { BillingModule } from './modules/billing/billing.module';
import { AutonomousEngineerModule } from './modules/autonomous-engineer/autonomous-engineer.module';
import { AiSearchModule } from './modules/ai-search/ai-search.module';
import { RepositoryGraphModule } from './modules/repository-graph/repository-graph.module';
import { AiVisibilityModule } from './modules/ai-visibility/ai-visibility.module';
import { StrategyModule } from './modules/strategy/strategy.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { AutomationModule } from './modules/automation/automation.module';
import { ActivityModule } from './modules/activity/activity.module';
import { GroqModule } from './modules/groq/groq.module';
import { AdminModule } from './modules/admin/admin.module';
import { LocalSeoModule } from './modules/local-seo/local-seo.module';
import { OutreachModule } from './modules/outreach/outreach.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { MarketIntelligenceModule } from './modules/market-intelligence/market-intelligence.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { MarketResearchModule } from './modules/market-research/market-research.module';
import { ContentIntelligenceModule } from './modules/content-intelligence/content-intelligence.module';
import { SeoToolsModule } from './modules/seo-tools/seo-tools.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // `@nestjs/throttler` was a dependency but was never registered, so no
    // route had any rate limit at all. Two buckets: a burst ceiling and a
    // sustained per-minute ceiling, both keyed on caller IP by default.
    //
    // `skipIf` restricts this to HTTP. The guard is registered via APP_GUARD,
    // which Nest also applies to WebSocket handlers, and the throttler resolves
    // its request through `switchToHttp()` — left unguarded it would misbehave
    // on the crawl-progress gateway.
    ThrottlerModule.forRoot({
      throttlers: [
        { name: 'burst', ttl: 1_000, limit: Number(process.env.THROTTLE_BURST_LIMIT ?? 10) },
        { name: 'sustained', ttl: 60_000, limit: Number(process.env.THROTTLE_LIMIT ?? 120) },
      ],
      skipIf: (context) => context.getType() !== 'http',
    }),
    ObservabilityModule,
    DatabaseModule,
    AgentsModule,
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
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ProjectsModule,
    BillingModule,
    AutonomousEngineerModule,
    AiSearchModule,
    RepositoryGraphModule,
    AiVisibilityModule,
    StrategyModule,
    PortfolioModule,
    AutomationModule,
    ActivityModule,
    GroqModule,
    AdminModule,
    LocalSeoModule,
    OutreachModule,
    ReportingModule,
    MarketIntelligenceModule,
    MonitoringModule,
    IntegrationsModule,
    MarketResearchModule,
    ContentIntelligenceModule,
    SeoToolsModule,
  ],

  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
