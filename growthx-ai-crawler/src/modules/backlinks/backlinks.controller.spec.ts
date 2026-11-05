import { INestApplication, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BacklinksController } from './backlinks.controller';
import { BacklinksService } from './backlinks.service';
import { BacklinkQueue } from './backlink-queue.service';
import { BacklinkAnalyticsService } from './backlink-analytics.service';
import { BacklinkDiscovery } from './backlink-discovery.service';
import { RecommendationService } from './recommendation.service';
import { BacklinkIntelligenceService } from './backlink-intelligence.service';
import { DataForSeoBacklinksService } from './dataforseo-backlinks.service';

describe('Backlinks intelligence HTTP contract', () => {
  let app: INestApplication;
  let base: string;
  const provider = { getDomainSummary: jest.fn() };
  const snapshots = { findFirst: jest.fn().mockResolvedValue(null) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [BacklinksController],
      providers: [
        ...[BacklinksService, BacklinkQueue, BacklinkAnalyticsService, BacklinkDiscovery, RecommendationService]
          .map((provide) => ({ provide, useValue: {} })),
        BacklinkIntelligenceService,
        { provide: DataForSeoBacklinksService, useValue: provider },
        { provide: PrismaService, useValue: {
          website: { findFirst: jest.fn().mockResolvedValue({ id: 'site-1', domain: 'example.com', url: 'https://example.com' }) },
          crawlJob: { findFirst: jest.fn().mockResolvedValue(null) },
          backlinkDomainSnapshot: snapshots,
        } },
      ],
    }).overrideGuard(JwtAuthGuard).useValue({
      canActivate: (context: any) => {
        if (context.switchToHttp().getRequest().headers.authorization !== 'Bearer test-session') {
          throw new UnauthorizedException();
        }
        return true;
      },
    }).compile();
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    base = await app.getUrl();
  });

  afterAll(async () => { await app?.close(); });

  it('registers the protected endpoint instead of returning route-not-found', async () => {
    const response = await fetch(`${base}/api/projects/project-1/backlinks/intelligence`);
    expect(response.status).toBe(401);
    expect(snapshots.findFirst).not.toHaveBeenCalled();
  });

  it('returns an empty snapshot without starting a billable refresh', async () => {
    const response = await fetch(`${base}/api/projects/project-1/backlinks/intelligence`, {
      headers: { Authorization: 'Bearer test-session' },
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(snapshots.findFirst).toHaveBeenCalledWith({
      where: { projectId: 'project-1', domain: 'example.com' }, orderBy: { checkedAt: 'desc' },
    });
    expect(provider.getDomainSummary).not.toHaveBeenCalled();
  });
});
