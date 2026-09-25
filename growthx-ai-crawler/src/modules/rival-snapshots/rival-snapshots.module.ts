import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { RivalSnapshotService } from './rival-snapshot.service';
import { RivalSnapshotScheduler } from './rival-snapshot.scheduler';

// DiscoveryService and FetcherService come from the global CrawlerModule.
@Module({
  imports: [DatabaseModule],
  providers: [RivalSnapshotService, RivalSnapshotScheduler],
  exports: [RivalSnapshotService],
})
export class RivalSnapshotsModule {}
