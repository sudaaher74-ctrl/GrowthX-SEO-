import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { FacebookService } from './facebook.service';
import { FacebookController } from './facebook.controller';
import { YoutubeService } from './youtube.service';
import { YoutubeController } from './youtube.controller';
import { GoogleOAuthService } from './google/google-oauth.service';
import { GoogleOAuthController, GoogleOAuthCallbackController } from './google/google-oauth.controller';
import { SearchConsoleService } from './google/search-console.service';
import { SearchConsoleInsightsService } from './google/search-console-insights.service';
import { SearchConsoleController } from './google/search-console.controller';
import { BusinessProfileService } from './google/business-profile.service';
import { BusinessProfileInsightsService } from './google/business-profile-insights.service';
import { BusinessProfileController } from './google/business-profile.controller';
import { GoogleSyncScheduler } from './google/google-sync.scheduler';
import { AnalyticsService } from './google/analytics.service';
import { AnalyticsInsightsService } from './google/analytics-insights.service';
import { AnalyticsController } from './google/analytics.controller';
import { DatabaseModule } from '../../database/database.module';

/**
 * Google Business Profile used to be served by two more providers here —
 * GoogleBusinessService and GbpService — each with its own OAuth round trip.
 * Both wrote `tokens.access_token` straight into `Integration.accessToken`, a
 * column every other connector fills with AES-256-GCM ciphertext, and one of
 * them authenticated its callback with an unsigned base64 state. They are gone:
 * Business Profile is now the `business_profile` provider on the shared Google
 * OAuth subsystem, which encrypts tokens and signs state like the rest.
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    IntegrationsService,
    GoogleOAuthService,
    SearchConsoleService,
    SearchConsoleInsightsService,
    AnalyticsService,
    AnalyticsInsightsService,
    BusinessProfileService,
    BusinessProfileInsightsService,
    GoogleSyncScheduler,
    FacebookService,
    YoutubeService,
  ],
  controllers: [
    IntegrationsController,
    GoogleOAuthController,
    GoogleOAuthCallbackController,
    SearchConsoleController,
    AnalyticsController,
    BusinessProfileController,
    FacebookController,
    YoutubeController,
  ],
  exports: [
    GoogleOAuthService,
    SearchConsoleService,
    // Exported so Keyword Intelligence, the Opportunity Center and the
    // Executive Dashboard read search data from one place rather than each
    // calling Google.
    SearchConsoleInsightsService,
    AnalyticsService,
    AnalyticsInsightsService,
    // Local SEO reads and writes the customer's profile through this — the
    // auditor to read it, the fix pusher to patch it.
    BusinessProfileService,
    BusinessProfileInsightsService,
    FacebookService,
    YoutubeService,
  ],
})
export class IntegrationsModule {}
