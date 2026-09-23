import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { decodeState, encodeState } from './google/oauth-state';
import { PrismaService } from '../../database/prisma.service';
import { OAuth2Client } from 'google-auth-library';
import { google } from './google/google-apis';

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);
  private oauth2Client: any;

  constructor(private readonly prisma: PrismaService) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/api/integrations/youtube/callback'
    );
  }

  /**
   * The connect link for a project the caller belongs to.
   *
   * The state is signed (shared with the Google flow): it used to be plain
   * base64 of the project id, so anyone could hand the callback a state naming
   * another customer's project and attach their own YouTube account to it.
   */
  async getAuthUrl(projectId: string, userId: string): Promise<string> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
    const member =
      project &&
      (await this.prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId, organizationId: project.organizationId } },
        select: { id: true },
      }));
    if (!project || !member) throw new NotFoundException('Project not found');
    const state = encodeState({ projectId, organizationId: project.organizationId, provider: 'youtube' });
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/youtube.readonly'],
      state,
    });
  }

  async handleCallback(code: string, state: string): Promise<void> {
    try {
      // Refuses any state this server did not sign, or one issued for another provider.
      const decodedState = decodeState(state);
      if (decodedState.provider !== 'youtube') throw new Error('OAuth state was issued for another provider.');
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
