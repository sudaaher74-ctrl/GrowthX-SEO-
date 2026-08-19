import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OAuth2Client } from 'google-auth-library';
import { mybusinessbusinessinformation_v1, google } from 'googleapis';
import * as crypto from 'crypto';

@Injectable()
export class GoogleBusinessService {
  private readonly logger = new Logger(GoogleBusinessService.name);
  private oauth2Client: any;

  constructor(private readonly prisma: PrismaService) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/integrations/google-business/callback'
    );
  }

  getAuthUrl(projectId: string): string {
    const state = Buffer.from(JSON.stringify({ projectId })).toString('base64');
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/business.manage'],
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
            provider: 'google_business',
          },
        },
        update: {
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || undefined,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
        },
        create: {
          projectId,
          provider: 'google_business',
          accessToken: tokens.access_token!,
          refreshToken: tokens.refresh_token || null,
          expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        },
      });
      
      this.logger.log(`Successfully connected Google Business for project ${projectId}`);
    } catch (error) {
      this.logger.error('Error handling Google Business callback', error);
      throw new Error('Failed to connect Google Business');
    }
  }

  async getClientForProject(projectId: string): Promise<mybusinessbusinessinformation_v1.Mybusinessbusinessinformation> {
    const integration = await this.prisma.integration.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider: 'google_business',
        },
      },
    });

    if (!integration) {
      throw new UnauthorizedException('Google Business not connected for this project');
    }

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );

    client.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken,
      expiry_date: integration.expiresAt ? integration.expiresAt.getTime() : null,
    });

    client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        await this.prisma.integration.update({
          where: { id: integration.id },
          data: {
            accessToken: tokens.access_token || undefined,
            refreshToken: tokens.refresh_token,
            expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
          },
        });
      } else if (tokens.access_token) {
        await this.prisma.integration.update({
          where: { id: integration.id },
          data: {
            accessToken: tokens.access_token,
            expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
          },
        });
      }
    });

    return google.mybusinessbusinessinformation({
      version: 'v1',
      auth: client,
    });
  }

  async getAccounts(projectId: string) {
    const client = await this.getClientForProject(projectId);
    
    // We need the account management API as well, which is in a different version.
    // For simplicity, we can fetch accounts using google.mybusinessaccountmanagement if needed, 
    // or locations directly if we know the account.
    // The new API usually requires knowing the account ID to list locations.
    
    // To list accounts, we need mybusinessaccountmanagement v1
    const accountClient = google.mybusinessaccountmanagement({
        version: 'v1',
        auth: client.context._options.auth
    });

    const res = await accountClient.accounts.list();
    return res.data.accounts || [];
  }

  async getLocations(projectId: string, accountId: string) {
    const client = await this.getClientForProject(projectId);
    
    const res = await client.accounts.locations.list({
      parent: accountId,
      readMask: 'name,title,storeCode,phoneNumbers,categories,storefrontAddress,websiteUri,profile,metadata'
    });

    return res.data.locations || [];
  }
}
