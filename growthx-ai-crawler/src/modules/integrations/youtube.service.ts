import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);
  private oauth2Client: OAuth2Client;

  constructor(private readonly prisma: PrismaService) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/api/integrations/youtube/callback'
    );
  }

  getAuthUrl(projectId: string): string {
    const state = Buffer.from(JSON.stringify({ projectId })).toString('base64');
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/youtube.readonly'],
      state,
    });
  }

  async handleCallback(code: string, state: string): Promise<void> {
    try {
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString('ascii'));
      const projectId = decodedState.projectId;

      const { tokens } = await this.oauth2Client.getToken(code);

      await this.prisma.integration.upsert({
        where: {
          projectId_provider: {
            projectId,
            provider: 'youtube',
          },
        },
        update: {
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || undefined,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        },
        create: {
          projectId,
          provider: 'youtube',
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || null,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        },
      });
      
      this.logger.log(`Successfully connected YouTube for project ${projectId}`);
    } catch (error) {
      this.logger.error('Error handling YouTube callback', error);
      throw new Error('Failed to connect YouTube');
    }
  }
}
