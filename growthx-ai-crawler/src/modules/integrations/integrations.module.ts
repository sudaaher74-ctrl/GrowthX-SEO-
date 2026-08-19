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
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [
    IntegrationsService, 
    GoogleBusinessService,
    FacebookService,
    YoutubeService,
    GbpService
  ],
  controllers: [
    IntegrationsController, 
    GoogleBusinessController,
    FacebookController,
    YoutubeController
  ],
  exports: [
    GoogleBusinessService,
    FacebookService,
    YoutubeService,
    GbpService
  ]
})
export class IntegrationsModule {}
