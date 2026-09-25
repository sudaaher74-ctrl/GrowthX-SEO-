import { AiSearchModule } from '../ai-search/ai-search.module';
import { CompetitorIntelReportService } from './competitor-intel-report.service';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CompetitorActionEngineController } from './competitor-action-engine.controller';
import { FindingsCollectorService } from './findings-collector.service';
import { StrategyEngineService } from './strategy-engine.service';
import { StrategyReadService } from './strategy-read.service';
import { CompetitorSetupService } from './competitor-setup.service';
import { CompetitorLocalService } from './competitor-local.service';
import { WebsiteComparisonService } from './website-comparison.service';
import { CompetitorSeoReportService } from './competitor-seo-report.service';
import { CompetitorInterceptService } from './competitor-intercept.service';
import { ProgrammaticDecompilerService } from './programmatic-decompiler.service';
import { CompetitorStealthRadarService } from './competitor-stealth-radar.service';
import { SiteProfileLoader } from './site-profile.loader';
import { LocalSeoModule } from '../local-seo/local-seo.module';

/**
 * The Competitor-to-Action Engine.
 *
 * Reads signal other modules already collect — crawls, Places, YouTube — and
 * turns it into evidence-backed actions. Deliberately depends on none of those
 * modules: it reads their stored output through Prisma, so a collector being
 * unavailable produces a stated coverage gap rather than a broken import.
 */
@Module({
  imports: [DatabaseModule, LocalSeoModule, AiSearchModule],
  controllers: [CompetitorActionEngineController],
  providers: [
    FindingsCollectorService,
    StrategyEngineService,
    StrategyReadService,
    CompetitorSetupService,
    CompetitorLocalService,
    WebsiteComparisonService,
    CompetitorIntelReportService,
    CompetitorSeoReportService,
    CompetitorInterceptService,
    ProgrammaticDecompilerService,
    CompetitorStealthRadarService,
    SiteProfileLoader,
  ],
  exports: [
    FindingsCollectorService,
    StrategyEngineService,
    StrategyReadService,
    CompetitorSetupService,
    CompetitorLocalService,
    WebsiteComparisonService,
    CompetitorSeoReportService,
    CompetitorInterceptService,
    ProgrammaticDecompilerService,
    CompetitorStealthRadarService,
    SiteProfileLoader,
  ],
})
export class CompetitorActionEngineModule {}
