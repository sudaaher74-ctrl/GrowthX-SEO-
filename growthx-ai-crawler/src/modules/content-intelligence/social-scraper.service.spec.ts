const listChannels = jest.fn();
const listPlaylistItems = jest.fn();
const listVideos = jest.fn();
jest.mock('googleapis', () => ({
  google: {
    youtube: () => ({
      channels: { list: listChannels },
      playlistItems: { list: listPlaylistItems },
      videos: { list: listVideos },
    }),
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SocialScraperService } from './social-scraper.service';

const ORG = 'org_1';
const PROJ = 'proj_1';

describe('SocialScraperService — competitor content ingestion', () => {
  let service: SocialScraperService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      competitorAccount: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'acc_1',
          organizationId: ORG,
          projectId: PROJ,
          platform: 'YOUTUBE',
          handle: 'UCabcdefghijklmnopqrstuv',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      competitorContent: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn().mockResolvedValue({}) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [SocialScraperService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(SocialScraperService);
    delete process.env.YOUTUBE_API_KEY;
  });

  it('refuses an account belonging to another organization', async () => {
    prisma.competitorAccount.findFirst.mockResolvedValue(null);

    await expect(service.syncYoutubeAccountContent(ORG, PROJ, 'acc_from_org_b')).rejects.toThrow(
      NotFoundException,
    );
  });

  // Returning quietly made a sync look successful and produce nothing, which is
  // indistinguishable from a competitor who posts nothing.
  it('says the key is missing rather than silently importing nothing', async () => {
    await expect(service.syncYoutubeAccountContent(ORG, PROJ, 'acc_1')).rejects.toThrow(
      /YOUTUBE_API_KEY is not set/,
    );
  });

  it('points Instagram and Facebook at manual entry instead of pretending to sync', async () => {
    prisma.competitorAccount.findFirst.mockResolvedValue({
      id: 'acc_2',
      organizationId: ORG,
      projectId: PROJ,
      platform: 'INSTAGRAM',
      handle: 'milquufresh',
    });

    await expect(service.syncYoutubeAccountContent(ORG, PROJ, 'acc_2')).rejects.toThrow(
      ServiceUnavailableException,
    );
    await expect(service.syncYoutubeAccountContent(ORG, PROJ, 'acc_2')).rejects.toThrow(
      /Add content manually/,
    );
  });

  describe('with a working YouTube key', () => {
    beforeEach(() => {
      process.env.YOUTUBE_API_KEY = 'x'.repeat(30);
      listChannels.mockResolvedValue({
        data: { items: [{ contentDetails: { relatedPlaylists: { uploads: 'UU_uploads' } } }] },
      });
      listPlaylistItems.mockResolvedValue({
        data: { items: [{ contentDetails: { videoId: 'vid1' } }, { contentDetails: { videoId: 'vid2' } }] },
      });
      listVideos.mockResolvedValue({
        data: {
          items: [
            {
              id: 'vid1',
              snippet: { title: 'Mango pulp process', description: 'd', publishedAt: '2026-08-01T00:00:00Z', tags: ['mango'], thumbnails: {} },
              statistics: { viewCount: '1200', likeCount: '30', commentCount: '4' },
              contentDetails: { duration: 'PT3M20S' },
            },
            {
              id: 'vid2',
              snippet: { title: 'Quick tip', description: '', publishedAt: '2026-08-02T00:00:00Z', thumbnails: {} },
              statistics: { viewCount: '800' },
              contentDetails: { duration: 'PT45S' },
            },
          ],
        },
      });
    });

    // The bug this method exists to fix: the old sync filled `socialPost`,
    // which classification, patterns, gaps and strategy never read.
    it('writes competitor content, which is what the pipeline reads', async () => {
      const result = await service.syncYoutubeAccountContent(ORG, PROJ, 'acc_1');

      expect(result).toMatchObject({ platform: 'YOUTUBE', fetched: 2, imported: 2 });
      expect(prisma.competitorContent.create).toHaveBeenCalledTimes(2);

      const first = prisma.competitorContent.create.mock.calls[0][0].data;
      expect(first).toMatchObject({
        organizationId: ORG,
        projectId: PROJ,
        accountId: 'acc_1',
        platform: 'YOUTUBE',
        contentType: 'VIDEO',
        title: 'Mango pulp process',
        viewsCount: 1200,
        likesCount: 30,
        engagementAvailable: true,
      });
    });

    it('classifies a video of 60s or less as a Short', async () => {
      await service.syncYoutubeAccountContent(ORG, PROJ, 'acc_1');

      const second = prisma.competitorContent.create.mock.calls[1][0].data;
      expect(second.contentType).toBe('SHORT');
      // Likes hidden on this one: absent, not zero.
      expect(second.likesCount).toBeNull();
    });

    it('does not re-import a video it already has', async () => {
      prisma.competitorContent.findMany.mockResolvedValue([
        { contentUrl: 'https://www.youtube.com/watch?v=vid1' },
      ]);

      const result = await service.syncYoutubeAccountContent(ORG, PROJ, 'acc_1');

      expect(result.imported).toBe(1);
      expect(prisma.competitorContent.create).toHaveBeenCalledTimes(1);
    });

    it('records when the account was last synced', async () => {
      await service.syncYoutubeAccountContent(ORG, PROJ, 'acc_1');

      expect(prisma.competitorAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'acc_1' } }),
      );
    });
  });
});
