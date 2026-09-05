import { OwnSocialSyncService, engagementRate } from './own-social-sync.service';
import { FetchedPost } from './social-scraper.service';

const post = (over: Partial<FetchedPost> = {}): FetchedPost => ({
  platform: 'YOUTUBE',
  postId: 'v1',
  contentType: 'VIDEO',
  title: 'How we do it',
  description: null,
  caption: 'How we do it',
  hashtags: [],
  contentUrl: 'https://www.youtube.com/watch?v=v1',
  thumbnailUrl: null,
  publishedAt: new Date('2026-08-01T00:00:00Z'),
  views: 1000,
  likes: 80,
  comments: 20,
  engagementAvailable: true,
  ...over,
});

describe('engagementRate', () => {
  it('is the share of viewers who reacted', () => {
    expect(engagementRate(post({ views: 1000, likes: 80, comments: 20 }))).toBe(10);
  });

  // Instagram Business Discovery reports no views at all. Returning zero would
  // rank every Instagram post below every YouTube one on a number nobody
  // measured, and the strategy reads this ordering to decide what has worked.
  it('is null when the platform reported no views, never zero', () => {
    expect(engagementRate(post({ platform: 'INSTAGRAM', views: null }))).toBeNull();
    expect(engagementRate(post({ engagementAvailable: false }))).toBeNull();
    expect(engagementRate(post({ views: 0 }))).toBeNull();
  });
});

describe('OwnSocialSyncService', () => {
  let prisma: any;
  let scraper: any;
  let service: OwnSocialSyncService;

  beforeEach(() => {
    prisma = {
      socialAccount: { findMany: jest.fn().mockResolvedValue([]) },
      socialPost: { upsert: jest.fn().mockResolvedValue({}) },
    };
    scraper = {
      readYoutubeUploads: jest.fn().mockResolvedValue([post()]),
      readInstagramMedia: jest.fn().mockResolvedValue([]),
    };
    service = new OwnSocialSyncService(prisma, scraper);
  });

  it('stores the customer\'s own posts as their own, not as a competitor\'s', async () => {
    prisma.socialAccount.findMany.mockResolvedValue([{ platform: 'YOUTUBE', handle: '@clientco' }]);

    const report = await service.syncProject('p1');

    expect(report.synced).toEqual([
      { platform: 'YOUTUBE', handle: '@clientco', fetched: 1, imported: 1 },
    ]);
    expect(prisma.socialPost.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId_platform_postId: { projectId: 'p1', platform: 'YOUTUBE', postId: 'v1' },
        },
        create: expect.objectContaining({ isCompetitor: false, authorHandle: '@clientco' }),
      }),
    );
  });

  it('refreshes the counts on a post it has seen before', async () => {
    prisma.socialAccount.findMany.mockResolvedValue([{ platform: 'YOUTUBE', handle: '@clientco' }]);

    await service.syncProject('p1');

    const [call] = prisma.socialPost.upsert.mock.calls[0];
    expect(call.update).toEqual(
      expect.objectContaining({ likes: 80, comments: 20, views: 1000, engagementRate: 10 }),
    );
  });

  it('reads each account through the API that platform actually has', async () => {
    prisma.socialAccount.findMany.mockResolvedValue([
      { platform: 'YOUTUBE', handle: '@clientco' },
      { platform: 'INSTAGRAM', handle: '@clientco' },
    ]);

    await service.syncProject('p1');

    expect(scraper.readYoutubeUploads).toHaveBeenCalledWith('@clientco', 25);
    expect(scraper.readInstagramMedia).toHaveBeenCalledWith('@clientco', 25);
  });

  // A sync that reports success and collects nothing is worse than one that
  // says which accounts it could not read.
  it('names the accounts it could not read, and why', async () => {
    prisma.socialAccount.findMany.mockResolvedValue([
      { platform: 'FACEBOOK', handle: 'ClientCo' },
      { platform: 'LINKEDIN', handle: 'company/clientco' },
    ]);

    const report = await service.syncProject('p1');

    expect(report.synced).toEqual([]);
    expect(report.skipped.map((s) => s.platform)).toEqual(['FACEBOOK', 'LINKEDIN']);
    expect(report.skipped[0].reason).toContain('cannot be read back');
  });

  it('carries on past one account that fails, and records the reason', async () => {
    prisma.socialAccount.findMany.mockResolvedValue([
      { platform: 'INSTAGRAM', handle: '@personal' },
      { platform: 'YOUTUBE', handle: '@clientco' },
    ]);
    scraper.readInstagramMedia.mockRejectedValue(new Error('personal accounts cannot be read this way'));

    const report = await service.syncProject('p1');

    expect(report.skipped[0].reason).toContain('personal accounts');
    expect(report.synced).toHaveLength(1);
  });

  it('explains an empty project rather than reporting a successful empty sync', async () => {
    const report = await service.syncProject('p1');

    expect(report.synced).toEqual([]);
    expect(report.skipped[0].reason).toContain('No social account is known');
  });
});
