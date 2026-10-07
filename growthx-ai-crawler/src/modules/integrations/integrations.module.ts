import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { GoogleOAuthService } from './google/google-oauth.service';
import { GoogleOAuthController, GoogleOAuthCallbackController } from './google/google-oauth.controller';
import { SearchConsoleService } from './google/search-console.service';
import { SearchConsoleInsightsService } from './google/search-console-insights.service';
import { SearchDemandService } from './google/search-demand.service';
import { SearchConsoleController } from './google/search-console.controller';
import { PlacesListingService } from './google/places-listing.service';
import { GoogleSyncScheduler } from './google/google-sync.scheduler';
import { AnalyticsService } from './google/analytics.service';
import { AnalyticsInsightsService } from './google/analytics-insights.service';
import { AnalyticsReportService } from './google/analytics-report.service';
import { AnalyticsController } from './google/analytics.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [
    IntegrationsService,
    GoogleOAuthService,
    SearchConsoleService,
    SearchConsoleInsightsService,
    SearchDemandService,
    AnalyticsService,
    AnalyticsInsightsService,
    AnalyticsReportService,
    PlacesListingService,
    GoogleSyncScheduler,
  ],
  controllers: [
    IntegrationsController,
    GoogleOAuthController,
    GoogleOAuthCallbackController,
    SearchConsoleController,
    AnalyticsController,
  ],
  exports: [
    GoogleOAuthService,
    SearchConsoleService,
    // Exported so Keyword Intelligence, the Opportunity Center and the
    // Executive Dashboard read search data from one place rather than each
    // calling Google.
    SearchConsoleInsightsService,
    // Real search numbers for the keyword ideas and Marketing Strategy.
    SearchDemandService,
    AnalyticsService,
    AnalyticsInsightsService,
    AnalyticsReportService,
    // The public Maps listing: what Local SEO audits and searches from while
    // Business Profile access waits on Google's approval.
    PlacesListingService,
  ],
})
export class IntegrationsModule {}
