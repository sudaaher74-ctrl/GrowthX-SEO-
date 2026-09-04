import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { google } from 'googleapis';
import axios from 'axios';

/** The slice of Business Discovery this reads. */
interface InstagramBusinessDiscovery {
  followers_count?: number;
  media_count?: number;
  media?: {
    data?: Array<{
      id?: string;
      caption?: string;
      like_count?: number;
      comments_count?: number;
      timestamp?: string;
      permalink?: string;
      media_url?: string;
      thumbnail_url?: string;
      media_type?: string;
    }>;
  };
}

@Injectable()
export class SocialScraperService {
  private readonly logger = new Logger(SocialScraperService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetches the latest public posts from a competitor's YouTube channel
   */
  async fetchYoutubeCompetitorData(projectId: string, channelId: string): Promise<void> {
    try {
      const apiKey = process.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        // Returning quietly here made a sync look like it worked and produced
        // nothing, which is indistinguishable from a competitor who posts
        // nothing. The caller has to be able to tell the difference.
        throw new ServiceUnavailableException(
          'YouTube ingestion is not configured: YOUTUBE_API_KEY is not set. ' +
            'Add competitor posts manually until it is.',
        );
      }

      const youtube = google.youtube({ version: 'v3', auth: apiKey });

      // Get channel details to find the uploads playlist ID
      const channelRes = await youtube.channels.list({
        part: ['contentDetails', 'snippet', 'statistics'],
        id: [channelId],
      });

      const channel = channelRes.data.items?.[0];
      if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
      }

      const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
      if (!uploadsPlaylistId) {
        throw new Error(`No uploads playlist found for channel ${channelId}`);
      }

      // Fetch the latest 10 videos
      const playlistRes = await youtube.playlistItems.list({
        part: ['snippet'],
        playlistId: uploadsPlaylistId,
        maxResults: 10,
      });

      const videoIds = playlistRes.data.items?.map(item => item.snippet?.resourceId?.videoId).filter(Boolean) as string[];

      if (!videoIds.length) {
        return;
      }

      // Fetch stats for these videos
      const videoRes = await youtube.videos.list({
        part: ['snippet', 'statistics'],
        id: videoIds,
      });

      const videos = videoRes.data.items || [];

      // Save to database
      for (const video of videos) {
        const stats = video.statistics;
        const snippet = video.snippet;
        const views = parseInt(stats?.viewCount || '0', 10);
        const likes = parseInt(stats?.likeCount || '0', 10);
        const comments = parseInt(stats?.commentCount || '0', 10);
        
        // Simple engagement rate calculation for YouTube: (likes + comments) / views
        const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;

        await this.prisma.socialPost.upsert({
          where: {
            platform_postId: {
              platform: 'YOUTUBE',
              postId: video.id!,
            }
          },
          update: {
            likes,
            comments,
            views,
            engagementRate,
            fetchedAt: new Date(),
          },
          create: {
            projectId,
            platform: 'YOUTUBE',
            postId: video.id!,
            isCompetitor: true,
            authorHandle: channel.snippet?.title || channelId,
            content: snippet?.title,
            url: `https://www.youtube.com/watch?v=${video.id}`,
            publishedAt: new Date(snippet?.publishedAt || Date.now()),
            likes,
            comments,
            views,
            engagementRate,
            fetchedAt: new Date(),
          }
        });
      }
      
      this.logger.log(`Successfully fetched ${videos.length} competitor YouTube videos for ${channelId}`);
    } catch (error) {
      // A missing key is a configuration answer the caller needs, not a
      // transient error to log and hide.
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error(`Error fetching YouTube competitor data for ${channelId}`, error);
    }
  }

  /**
   * Instagram and Facebook ingestion is not built.
   *
   * This was an empty method that logged "Fetching…" and returned, so a caller
   * saw a successful sync that silently produced nothing. Neither platform has
   * a usable public API for competitor content — it needs a paid scraper
   * (Apify's Instagram actor or equivalent) and a token nobody has configured —
   * so this says so rather than pretending. The manual ingestion path
   * (`POST competitor-content`) accepts these posts today.
   */
  async fetchMetaCompetitorData(projectId: string, handle: string, platform: 'FACEBOOK' | 'INSTAGRAM'): Promise<void> {
    throw new ServiceUnavailableException(
      `Automated ${platform} ingestion is not available. ` +
        `Add ${handle}'s posts through "Add content manually" — the rest of the pipeline ` +
        'treats manually added content exactly the same.',
    );
  }

  /**
   * Pulls a competitor's recent YouTube uploads into the Content Intelligence
   * pipeline.
   *
   * Deliberately separate from `fetchYoutubeCompetitorData`, which writes
   * `socialPost` rows for a different feature. Classification, pattern
   * detection, gap analysis and strategy all read `CompetitorContent`, so a
   * sync that fills `socialPost` leaves this pipeline exactly as empty as
   * before — which is why Content Intelligence showed nothing on a deployment
   * that had a scraper.
   *
   * Deduplicates on the video URL rather than a unique constraint so re-syncing
   * a channel is cheap and needs no migration.
   */
  async syncYoutubeAccountContent(
    organizationId: string,
    projectId: string,
    accountId: string,
    maxResults = 25,
  ): Promise<{ platform: string; handle: string; fetched: number; imported: number }> {
    const account = await this.prisma.competitorAccount.findFirst({
      where: { id: accountId, organizationId, projectId },
    });
    if (!account) {
      throw new NotFoundException('Competitor account not found for this project.');
    }
    if (account.platform !== 'YOUTUBE') {
      // Meta has no ingestion at all; saying which platform this is keeps the
      // message useful rather than generic.
      return this.unsupportedPlatform(account.platform, account.handle);
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'YouTube ingestion is not configured: YOUTUBE_API_KEY is not set. ' +
          'Add competitor posts manually until it is.',
      );
    }

    const youtube = google.youtube({ version: 'v3', auth: apiKey });
    const channelId = await this.resolveChannelId(youtube, account.handle);

    const channelRes = await youtube.channels.list({ part: ['contentDetails'], id: [channelId] });
    const uploads = channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) {
      throw new NotFoundException(`YouTube channel ${account.handle} has no public uploads playlist.`);
    }

    const playlist = await youtube.playlistItems.list({
      part: ['snippet', 'contentDetails'],
      playlistId: uploads,
      maxResults,
    });
    const items = playlist.data.items ?? [];
    const videoIds = items
      .map((i) => i.contentDetails?.videoId)
      .filter((id): id is string => Boolean(id));

    if (videoIds.length === 0) {
      await this.markSynced(account.id);
      return { platform: 'YOUTUBE', handle: account.handle, fetched: 0, imported: 0 };
    }

    // Statistics live on the video resource, not the playlist item.
    const details = await youtube.videos.list({
      part: ['snippet', 'statistics', 'contentDetails'],
      id: videoIds,
    });

    const existing = await this.prisma.competitorContent.findMany({
      where: { organizationId, projectId, accountId: account.id },
      select: { contentUrl: true },
    });
    const seen = new Set(existing.map((row) => row.contentUrl).filter(Boolean));

    let imported = 0;
    for (const video of details.data.items ?? []) {
      const url = `https://www.youtube.com/watch?v=${video.id}`;
      if (seen.has(url)) continue;

      const snippet = video.snippet;
      const stats = video.statistics;

      await this.prisma.competitorContent.create({
        data: {
          organizationId,
          projectId,
          accountId: account.id,
          platform: 'YOUTUBE',
          contentType: this.youtubeContentType(video.contentDetails?.duration),
          title: snippet?.title ?? null,
          description: snippet?.description ?? null,
          caption: snippet?.title ?? null,
          hashtags: snippet?.tags ?? [],
          contentUrl: url,
          thumbnailUrl: snippet?.thumbnails?.high?.url ?? snippet?.thumbnails?.default?.url ?? null,
          publishedAt: snippet?.publishedAt ? new Date(snippet.publishedAt) : null,
          viewsCount: numberOrNull(stats?.viewCount),
          likesCount: numberOrNull(stats?.likeCount),
          commentsCount: numberOrNull(stats?.commentCount),
          // Only true when the platform actually reported engagement: a video
          // with likes hidden must not be read as a video nobody liked.
          engagementAvailable: stats?.likeCount != null || stats?.viewCount != null,
        },
      });
      imported++;
    }

    await this.markSynced(account.id);
    this.logger.log(`Imported ${imported} new YouTube item(s) for ${account.handle}.`);
    return { platform: 'YOUTUBE', handle: account.handle, fetched: videoIds.length, imported };
  }

  /**
   * Syncs one competitor account, whichever platform it is on.
   *
   * The controller used to call the YouTube method directly, so an Instagram
   * account's sync button reached YouTube code that immediately rejected it.
   * Dispatching here keeps the caller honest about what it is asking for.
   */
  async syncAccountContent(
    organizationId: string,
    projectId: string,
    accountId: string,
    maxResults = 25,
  ): Promise<{ platform: string; handle: string; fetched: number; imported: number }> {
    const account = await this.prisma.competitorAccount.findFirst({
      where: { id: accountId, organizationId, projectId },
      select: { platform: true, handle: true },
    });
    if (!account) {
      throw new NotFoundException('Competitor account not found for this project.');
    }

    if (account.platform === 'YOUTUBE') {
      return this.syncYoutubeAccountContent(organizationId, projectId, accountId, maxResults);
    }
    if (account.platform === 'INSTAGRAM') {
      return this.syncInstagramAccountContent(organizationId, projectId, accountId, maxResults);
    }
    return this.unsupportedPlatform(account.platform, account.handle);
  }

  /**
   * Pulls a competitor's recent Instagram posts into the same pipeline.
   *
   * Uses Business Discovery, which is the only way Meta permits reading an
   * account you do not own: the query runs *from* an Instagram Business
   * account the deployment owns and names the competitor by username. One
   * platform-owned account therefore serves every customer, exactly as one
   * YouTube key does — no per-customer Facebook app, and no scraping, which
   * would breach Meta's terms and break whenever the markup changed.
   *
   * Two limits are inherent rather than incidental, and worth knowing before
   * anyone reads a gap as a finding. Only Business and Creator accounts are
   * discoverable — a competitor on a personal account returns nothing, which
   * is not the same as posting nothing. And Business Discovery exposes likes
   * and comments but no view or play counts, so `engagementAvailable` is set
   * from what actually came back rather than assumed.
   */
  async syncInstagramAccountContent(
    organizationId: string,
    projectId: string,
    accountId: string,
    maxResults = 25,
  ): Promise<{ platform: string; handle: string; fetched: number; imported: number }> {
    const account = await this.prisma.competitorAccount.findFirst({
      where: { id: accountId, organizationId, projectId },
    });
    if (!account) {
      throw new NotFoundException('Competitor account not found for this project.');
    }
    if (account.platform !== 'INSTAGRAM') {
      return this.unsupportedPlatform(account.platform, account.handle);
    }

    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
    if (!token || !igUserId) {
      throw new ServiceUnavailableException(
        'Instagram ingestion is not configured: INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID must both ' +
          'be set. Add competitor posts manually until they are.',
      );
    }

    const username = account.handle.replace(/^@/, '').trim();
    const fields =
      `business_discovery.username(${username}){followers_count,media_count,` +
      `media.limit(${maxResults}){id,caption,like_count,comments_count,timestamp,permalink,media_url,thumbnail_url,media_type}}`;

    let discovery: InstagramBusinessDiscovery | undefined;
    try {
      const { data } = await axios.get<{ business_discovery?: InstagramBusinessDiscovery }>(
        `https://graph.facebook.com/v21.0/${igUserId}`,
        { params: { fields, access_token: token }, timeout: 20_000 },
      );
      discovery = data.business_discovery;
    } catch (err: any) {
      const detail = err?.response?.data?.error?.message || err?.message || 'unknown error';
      // Meta returns the same shape for "no such account", "not a business
      // account" and "token expired", and the customer's next step differs
      // for each — so the message is passed through rather than flattened.
      throw new ServiceUnavailableException(`Instagram lookup failed for @${username}: ${detail}`);
    }

    if (!discovery) {
      throw new NotFoundException(
        `@${username} could not be read through Instagram Business Discovery. Only Business and Creator accounts ` +
          'are discoverable; a personal account cannot be read this way.',
      );
    }

    const media = discovery.media?.data ?? [];
    const existing = await this.prisma.competitorContent.findMany({
      where: { organizationId, projectId, accountId: account.id },
      select: { contentUrl: true },
    });
    const seen = new Set(existing.map((row) => row.contentUrl).filter(Boolean));

    let imported = 0;
    for (const post of media) {
      const url = post.permalink;
      if (!url || seen.has(url)) continue;

      const caption = post.caption ?? null;
      await this.prisma.competitorContent.create({
        data: {
          organizationId,
          projectId,
          accountId: account.id,
          platform: 'INSTAGRAM',
          contentType: this.instagramContentType(post.media_type),
          title: caption ? caption.split('\n')[0].slice(0, 200) : null,
          description: caption,
          caption,
          hashtags: hashtagsFrom(caption),
          contentUrl: url,
          thumbnailUrl: post.thumbnail_url ?? post.media_url ?? null,
          publishedAt: post.timestamp ? new Date(post.timestamp) : null,
          // Business Discovery reports no view or play count at all.
          viewsCount: null,
          likesCount: post.like_count ?? null,
          commentsCount: post.comments_count ?? null,
          engagementAvailable: post.like_count != null || post.comments_count != null,
        },
      });
      imported++;
    }

    await this.markSynced(account.id);
    this.logger.log(`Imported ${imported} new Instagram item(s) for @${username}.`);
    return { platform: 'INSTAGRAM', handle: account.handle, fetched: media.length, imported };
  }

  /** Maps Meta's media_type onto the pipeline's content types. */
  private instagramContentType(mediaType?: string): string {
    if (mediaType === 'VIDEO') return 'REEL';
    if (mediaType === 'CAROUSEL_ALBUM') return 'CAROUSEL';
    return 'IMAGE';
  }

  private unsupportedPlatform(platform: string, handle: string): never {
    throw new ServiceUnavailableException(
      `Automated ${platform} ingestion is not available. ` +
        `Add ${handle}'s posts through "Add content manually" — the rest of the pipeline ` +
        'treats manually added content exactly the same.',
    );
  }

  private async markSynced(accountId: string): Promise<void> {
    await this.prisma.competitorAccount.update({
      where: { id: accountId },
      data: { lastSyncedAt: new Date() },
    });
  }

  /** Accepts a raw channel id, an @handle, or a channel URL. */
  private async resolveChannelId(youtube: any, handle: string): Promise<string> {
    const trimmed = handle.trim();
    const fromUrl = trimmed.match(/youtube\.com\/(?:channel\/)?(UC[\w-]{22})/)?.[1];
    if (fromUrl) return fromUrl;
    if (/^UC[\w-]{22}$/.test(trimmed)) return trimmed;

    const forHandle = trimmed.replace(/^.*youtube\.com\/@/, '@').replace(/^@?/, '@');
    const byHandle = await youtube.channels.list({ part: ['id'], forHandle });
    const id = byHandle.data.items?.[0]?.id;
    if (id) return id;

    throw new NotFoundException(
      `Could not resolve YouTube channel "${handle}". Use the channel id (UC…) or its @handle.`,
    );
  }

  /** YouTube reports Shorts only through duration; anything <= 60s is a Short. */
  private youtubeContentType(isoDuration?: string | null): string {
    if (!isoDuration) return 'VIDEO';
    const m = isoDuration.match(/^PT(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!m) return 'VIDEO';
    const seconds = Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
    return seconds > 0 && seconds <= 60 ? 'SHORT' : 'VIDEO';
  }
}

function numberOrNull(value?: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Hashtags as written in the caption, which is where Instagram keeps them. */
function hashtagsFrom(caption: string | null): string[] {
  if (!caption) return [];
  const found = caption.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return [...new Set(found.map((tag) => tag.slice(1).toLowerCase()))].slice(0, 30);
}
