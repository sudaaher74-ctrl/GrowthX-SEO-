import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class FacebookService {
  private readonly logger = new Logger(FacebookService.name);

  constructor(private readonly prisma: PrismaService) {}

  getAuthUrl(projectId: string): string {
    const state = Buffer.from(JSON.stringify({ projectId })).toString('base64');
    const clientId = process.env.FACEBOOK_CLIENT_ID;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:3000/api/integrations/facebook/callback';
    
    return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=pages_show_list,pages_read_engagement,instagram_basic,instagram_manage_insights,pages_read_user_content`;
  }

  async handleCallback(code: string, state: string): Promise<void> {
    try {
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString('ascii'));
      const projectId = decodedState.projectId;
      
      const clientId = process.env.FACEBOOK_CLIENT_ID;
      const clientSecret = process.env.FACEBOOK_CLIENT_SECRET;
      const redirectUri = process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:3000/api/integrations/facebook/callback';

      // 1. Exchange code for short-lived access token
      const tokenRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
        params: {
          client_id: clientId,
          redirect_uri: redirectUri,
          client_secret: clientSecret,
          code,
        },
      });
      
      const shortLivedToken = tokenRes.data.access_token;

      // 2. Exchange short-lived token for long-lived token
      const longLivedRes = await axios.get('https://graph.facebook.com/v19.0/oauth/access_token', {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: clientId,
          client_secret: clientSecret,
          fb_exchange_token: shortLivedToken,
        },
      });

      const accessToken = longLivedRes.data.access_token;
      
      // Facebook long-lived tokens don't use refresh tokens, they just last 60 days
      // and need to be refreshed by sending the user through OAuth again.

      await this.prisma.integration.upsert({
        where: {
          projectId_provider: {
            projectId,
            provider: 'facebook',
          },
        },
        update: {
          accessToken: accessToken,
          refreshToken: null,
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        },
        create: {
          projectId,
          provider: 'facebook',
          accessToken: accessToken,
          refreshToken: null,
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        },
      });
      
      this.logger.log(`Successfully connected Facebook/Instagram for project ${projectId}`);
    } catch (error) {
      this.logger.error('Error handling Facebook callback', error);
      throw new Error('Failed to connect Facebook');
    }
  }
}
