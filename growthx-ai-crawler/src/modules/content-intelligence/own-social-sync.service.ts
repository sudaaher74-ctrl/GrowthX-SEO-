import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FetchedPost, SocialScraperService } from './social-scraper.service';

/** Platforms whose posts can actually be read back. */
const READABLE = ['YOUTUBE', 'INSTAGRAM'];

export interface OwnSyncResult {
  platform: string;
  handle: string;
  fetched: number;
  imported: number;
}

export interface OwnSyncReport {
  synced: OwnSyncResult[];
  /** Accounts that could not be read, and why — never silently dropped. */
  skipped: Array<{ platform: string; handle: string | null; reason: string }>;
}

/**
 * The customer's own social posts, read the same way competitors' are.
 *
 * Nothing collected these. `SocialPost.isCompetitor` existed, and the content
 * strategy asked for "top performing owned social posts" on every run, but the
 * only writer of that table set `isCompetitor: true` unconditionally and had no
 * callers — so the customer's own social presence was absent from every
 * strategy the product has ever produced. A strategy for getting more reach
 * that has never seen what the brand already posts is guessing at half the
 * problem.
 *
 * The handles come from the accounts the site crawl found published on the
 * customer's own website, so this needs nothing typed in and no OAuth: reading
 * a public Business account by username is what YouTube's Data API and
 * Instagram's Business Discovery both already do for competitors.
 */
@Injectable()
export class OwnSocialSyncService {
  private readonly logger = new Logger(OwnSocialSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scraper: SocialScraperService,
  ) {}

  async syncProject(projectId: string, maxResults = 25): Promise<OwnSyncReport> {
    const accounts = await this.prisma.socialAccount.findMany({
      where: { projectId },
      select: { platform: true, handle: true },
    });

    const synced: OwnSyncResult[] = [];
    const skipped: OwnSyncReport['skipped'] = [];

    if (accounts.length === 0) {
      skipped.push({
        platform: '—',
        handle: null,
        reason:
          'No social account is known for this project yet. They are found automatically from the links ' +
          "published on the customer's own website the next time it is crawled.",
      });
      return { synced, skipped };
    }

    for (const account of accounts) {
      if (!account.handle) {
        skipped.push({ platform: account.platform, handle: null, reason: 'No handle is recorded.' });
        continue;
      }
      if (!READABLE.includes(account.platform)) {
        // Facebook, LinkedIn, TikTok and X have no API that returns another
        // account's posts, so saying so beats a sync that reports success and
        // collects nothing.
        skipped.push({
          platform: account.platform,
          handle: account.handle,
          reason: `${account.platform} posts cannot be read back through any available API.`,
        });
        continue;
      }

      try {
        const posts =
          account.platform === 'YOUTUBE'
            ? await this.scraper.readYoutubeUploads(account.handle, maxResults)
            : await this.scraper.readInstagramMedia(account.handle, maxResults);

        const imported = await this.store(projectId, account.handle, posts);
        synced.push({ platform: account.platform, handle: account.handle, fetched: posts.length, imported });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        skipped.push({ platform: account.platform, handle: account.handle, reason });
        this.logger.warn(`Could not read own ${account.platform} account ${account.handle}: ${reason}`);
      }
    }

    const total = synced.reduce((sum, entry) => sum + entry.imported, 0);
    if (total > 0) this.logger.log(`Collected ${total} of the customer's own post(s) for project ${projectId}.`);
    return { synced, skipped };
  }

  private async store(projectId: string, handle: string, posts: FetchedPost[]): Promise<number> {
    let imported = 0;

    for (const post of posts) {
      const metrics = {
        likes: post.likes ?? 0,
        comments: post.comments ?? 0,
        views: post.views ?? 0,
        engagementRate: engagementRate(post),
      };

      await this.prisma.socialPost.upsert({
        where: {
          projectId_platform_postId: { projectId, platform: post.platform, postId: post.postId },
        },
        // Counts move after publication, so an existing row is refreshed rather
        // than left at whatever it said the day it was collected.
        update: { ...metrics, fetchedAt: new Date() },
        create: {
          projectId,
          platform: post.platform,
          postId: post.postId,
          isCompetitor: false,
          authorHandle: handle,
          content: post.caption ?? post.title,
          url: post.contentUrl,
          publishedAt: post.publishedAt ?? new Date(),
          ...metrics,
          fetchedAt: new Date(),
        },
      });
      imported++;
    }

    return imported;
  }
}

/**
 * Engagement as a percentage of the audience that actually saw the post.
 *
 * Null when the platform reported no views — Instagram Business Discovery
 * reports none at all. Returning zero there would rank every Instagram post
 * below every YouTube one on a number that was never measured, and the
 * strategy reads this ordering to decide what has worked.
 */
export function engagementRate(post: FetchedPost): number | null {
  if (!post.engagementAvailable) return null;
  if (post.views == null || post.views <= 0) return null;
  return ((post.likes ?? 0) + (post.comments ?? 0)) / post.views * 100;
}
