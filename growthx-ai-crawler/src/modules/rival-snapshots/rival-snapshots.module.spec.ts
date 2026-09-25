import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { DiscoveryService } from '../crawler/discovery/discovery.service';
import { FetcherService } from '../crawler/fetcher.service';
import { RivalSnapshotsModule } from './rival-snapshots.module';
import { RivalSnapshotScheduler } from './rival-snapshot.scheduler';

// Stands in for the global CrawlerModule the real app provides.
@Global()
@Module({
  providers: [
    { provide: DiscoveryService, useValue: {} },
    { provide: FetcherService, useValue: {} },
  ],
  exports: [DiscoveryService, FetcherService],
})
class FakeCrawlerModule {}

describe('RivalSnapshotsModule wiring', () => {
  it('resolves the service and scheduler, so the app can boot with it', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [FakeCrawlerModule, RivalSnapshotsModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    expect(moduleRef.get(RivalSnapshotScheduler)).toBeInstanceOf(RivalSnapshotScheduler);
  });
});
