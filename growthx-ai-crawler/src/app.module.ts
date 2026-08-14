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
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
