import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { google } from 'googleapis';

@Injectable()
export class GbpService {
  private readonly logger = new Logger(GbpService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async getAuthenticatedClient(projectId: string) {
    const integration = await this.prisma.integration.findUnique({
      where: {
        projectId_provider: {
          projectId,
          provider: 'google_business',
        },
      },
    });

    if (!integration) {
      throw new Error(`Google Business Profile integration not found for project ${projectId}`);
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );

    oauth2Client.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken,
      expiry_date: integration.expiresAt ? integration.expiresAt.getTime() : null,
    });

    return oauth2Client;
  }

  /**
   * Fetches the first verified location for the authenticated user.
   */
  async getLocation(projectId: string) {
    try {
      const auth = await this.getAuthenticatedClient(projectId);
      
      // Use the discovery API to load the My Business API since it's not in the default googleapis bundle
      const mybusiness = await google.discoverAPI('https://mybusinessbusinessinformation.googleapis.com/$discovery/rest?version=v1');
      const accountManagement = await google.discoverAPI('https://mybusinessaccountmanagement.googleapis.com/$discovery/rest?version=v1');

      // 1. Get Accounts
      const accountsRes = await (accountManagement.accounts as any).list({ auth });
      const accounts = accountsRes.data.accounts;

      if (!accounts || accounts.length === 0) {
        throw new Error('No Google Business Profile accounts found.');
      }

      // 2. Get Locations for the first account
      const accountName = accounts[0].name;
      const locationsRes = await (mybusiness.accounts as any).locations.list({
        parent: accountName,
        readMask: 'name,title,storeCode,storefrontAddress,regularHours,specialHours,serviceArea,labels,categories,profile,phoneNumbers,websiteUri',
        auth,
      });

      const locations = locationsRes.data.locations;

      if (!locations || locations.length === 0) {
        throw new Error('No locations found for this account.');
      }

      return locations[0];
    } catch (error) {
      this.logger.error(`Error fetching GBP location for project ${projectId}`, error);
      throw error;
    }
  }

  /**
   * Patches the GBP location with the specified data.
   */
  async patchLocation(projectId: string, locationName: string, updateMask: string, data: any) {
    try {
      const auth = await this.getAuthenticatedClient(projectId);
      const mybusiness = await google.discoverAPI('https://mybusinessbusinessinformation.googleapis.com/$discovery/rest?version=v1');

      const res = await (mybusiness.locations as any).patch({
        name: locationName,
        updateMask,
        requestBody: data,
        auth,
      });

      this.logger.log(`Successfully patched location ${locationName} for project ${projectId}`);
      return res.data;
    } catch (error) {
      this.logger.error(`Error patching GBP location for project ${projectId}`, error);
      throw error;
    }
  }
}
