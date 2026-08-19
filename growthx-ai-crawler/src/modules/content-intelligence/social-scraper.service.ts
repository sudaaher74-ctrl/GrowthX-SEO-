import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import axios from 'axios';
import { google } from 'googleapis';

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
        this.logger.warn('YOUTUBE_API_KEY is not set. Skipping YouTube competitor tracking.');
        return;
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
      this.logger.error(`Error fetching YouTube competitor data for ${channelId}`, error);
    }
  }

  /**
   * Stub for fetching Facebook/Instagram public data.
   * In a production environment, this would hit a third-party scraper API like Apify
   * since Meta's official API does not allow arbitrary public page scraping without permissions.
   */
  async fetchMetaCompetitorData(projectId: string, handle: string, platform: 'FACEBOOK' | 'INSTAGRAM'): Promise<void> {
    this.logger.log(`Fetching ${platform} competitor data for ${handle} (via scraper API)`);
    
    // TODO: Implement actual scraper call (e.g. Apify Instagram Scraper actor)
    // For now, this is a stub that allows the architecture to function.
  }
}
