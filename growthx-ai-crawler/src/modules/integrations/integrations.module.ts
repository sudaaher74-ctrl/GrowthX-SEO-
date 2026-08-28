import { Module } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { GoogleBusinessService } from './google-business.service';
import { GoogleBusinessController } from './google-business.controller';
import { FacebookService } from './facebook.service';
import { FacebookController } from './facebook.controller';
import { YoutubeService } from './youtube.service';
import { YoutubeController } from './youtube.controller';
import { GbpService } from './gbp.service';
import { GoogleOAuthService } from './google/google-oauth.service';
import { GoogleOAuthController, GoogleOAuthCallbackController } from './google/google-oauth.controller';
import { SearchConsoleService } from './google/search-console.service';
import { SearchConsoleInsightsService } from './google/search-console-insights.service';
import { SearchConsoleController } from './google/search-console.controller';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [
    IntegrationsService, 
    GoogleOAuthService,
    SearchConsoleService,
    SearchConsoleInsightsService,
    GoogleBusinessService,
    FacebookService,
    YoutubeService,
    GbpService
  ],
  controllers: [
    IntegrationsController, 
    GoogleOAuthController,
    GoogleOAuthCallbackController,
    SearchConsoleController,
    GoogleBusinessController,
    FacebookController,
    YoutubeController
  ],
  exports: [
    GoogleOAuthService,
    SearchConsoleService,
    // Exported so Keyword Intelligence, the Opportunity Center and the
    // Executive Dashboard read search data from one place rather than each
    // calling Google.
    SearchConsoleInsightsService,
    GoogleBusinessService,
    FacebookService,
    YoutubeService,
    GbpService
  ]
})
export class IntegrationsModule {}
