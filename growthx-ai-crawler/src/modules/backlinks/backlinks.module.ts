import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { QueueModule } from "../queue/queue.module";
import { BacklinkFetcher } from "./backlink-fetcher.service";
import { BacklinkQueue } from "./backlink-queue.service";
import { BacklinksController } from "./backlinks.controller";
import { BacklinksService } from "./backlinks.service";
import { BacklinkAnalyticsService } from "./backlink-analytics.service";
import { PublicBacklinkIndex } from "./public-backlink-index.service";
import { BacklinkDiscovery } from "./backlink-discovery.service";
import { RecommendationService } from "./recommendation.service";

@Module({
  imports: [DatabaseModule, QueueModule],
  controllers: [BacklinksController],
  providers: [
    BacklinksService,
    BacklinkFetcher,
    BacklinkQueue,
    BacklinkAnalyticsService,
    PublicBacklinkIndex,
    BacklinkDiscovery,
    RecommendationService,
  ],
  exports: [BacklinksService],
})
export class BacklinksModule {}
