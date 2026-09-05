import { NotFoundException } from '@nestjs/common';
import { DiscoveryStatusService } from './discovery-status.service';

describe('DiscoveryStatusService', () => {
  let prisma: any;
  let service: DiscoveryStatusService;

  const project = {
    id: 'p1',
    createdAt: new Date('2026-09-01T00:00:00Z'),
    competitorsIdentifiedAt: null as Date | null,
    businessProfile: null as any,
    websites: [{ id: 'w1', domain: 'clientco.com' }],
  };

  beforeEach(() => {
    prisma = {
      project: { findFirst: jest.fn().mockResolvedValue(project) },
      crawlJob: { findFirst: jest.fn().mockResolvedValue(null) },
      competitorDomain: { findMany: jest.fn().mockResolvedValue([]) },
      socialAccount: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new DiscoveryStatusService(prisma);
  });

  it('refuses a project outside the caller organisation', async () => {
    prisma.project.findFirst.mockResolvedValue(null);
    await expect(service.getStatus('org1', 'p1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reports a fresh project as waiting on its first crawl', async () => {
    const status = await service.getStatus('org1', 'p1');

    expect(status.steps.websiteAdded.state).toBe('done');
    expect(status.steps.websiteCrawled.state).toBe('pending');
    expect(status.steps.businessIdentified.state).toBe('pending');
    expect(status.steps.competitorsIdentified.state).toBe('pending');
  });

  // "Not crawled yet" and "crawled, has no pages" are opposite conclusions, so
  // a step that has not run never reports a count.
  it('never reports a zero for a step that has not run', async () => {
    const status = await service.getStatus('org1', 'p1');

    expect(status.steps.competitorsCrawled.detail).toBe('No competitor is being tracked yet.');
    expect(status.steps.websiteCrawled.detail).toBe('This site has not been crawled yet.');
  });

  it('shows a crawl that is under way with the pages it has so far', async () => {
    prisma.crawlJob.findFirst.mockResolvedValue({
      status: 'RUNNING',
      pagesCrawled: 12,
      startedAt: new Date('2026-09-05T01:00:00Z'),
      finishedAt: null,
    });

    const status = await service.getStatus('org1', 'p1');

    expect(status.steps.websiteCrawled.state).toBe('running');
    expect(status.steps.websiteCrawled.detail).toBe('12 page(s) so far.');
  });

  it('surfaces a failed crawl as failed rather than as not started', async () => {
    prisma.crawlJob.findFirst.mockResolvedValue({
      status: 'FAILED',
      pagesCrawled: 0,
      startedAt: new Date(),
      finishedAt: new Date(),
    });

    expect((await service.getStatus('org1', 'p1')).steps.websiteCrawled.state).toBe('failed');
  });

  it('reports the detected business in the operator\'s own terms', async () => {
    prisma.project.findFirst.mockResolvedValue({
      ...project,
      businessProfile: {
        businessName: 'ClientCo',
        industry: 'Organic dairy delivery',
        confidence: 'high',
        detectedAt: new Date('2026-09-05T02:00:00Z'),
      },
    });

    const step = (await service.getStatus('org1', 'p1')).steps.businessIdentified;
    expect(step.state).toBe('done');
    expect(step.detail).toContain('Organic dairy delivery');
  });

  it('counts how many tracked competitors have actually been crawled', async () => {
    prisma.competitorDomain.findMany.mockResolvedValue([
      { id: 'c1', domain: 'a.com', name: 'A', status: 'ANALYZED', lastAnalyzedAt: new Date(), socialAccounts: [{ platform: 'INSTAGRAM', handle: '@a' }] },
      { id: 'c2', domain: 'b.com', name: 'B', status: 'ANALYZING', lastAnalyzedAt: null, socialAccounts: [] },
    ]);

    const status = await service.getStatus('org1', 'p1');

    expect(status.steps.competitorsCrawled).toEqual(
      expect.objectContaining({ state: 'running', detail: '1 of 2 competitor site(s) crawled so far.' }),
    );
    expect(status.competitors[1].lastAnalyzedAt).toBeNull();
  });

  it('says identification ran even when it verified nobody', async () => {
    prisma.project.findFirst.mockResolvedValue({
      ...project,
      competitorsIdentifiedAt: new Date('2026-09-05T02:30:00Z'),
    });

    const step = (await service.getStatus('org1', 'p1')).steps.competitorsIdentified;
    expect(step.state).toBe('done');
    expect(step.detail).toContain('found no competitor that could be verified');
  });

  it('separates an account read off the site from one the customer connected', async () => {
    prisma.socialAccount.findMany.mockResolvedValue([
      { platform: 'INSTAGRAM', handle: '@clientco', profileUrl: 'u', discoverySource: 'WEBSITE_CRAWL', status: 'DISCONNECTED' },
      { platform: 'FACEBOOK', handle: 'ClientCo', profileUrl: 'u2', discoverySource: null, status: 'CONNECTED' },
    ]);

    const status = await service.getStatus('org1', 'p1');

    expect(status.ownSocialAccounts.map((a) => a.origin)).toEqual(['crawl', 'connected']);
    expect(status.steps.socialAccountsFound.state).toBe('done');
  });
});
