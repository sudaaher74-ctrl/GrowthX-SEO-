import { FacebookService } from './facebook.service';
import { YoutubeService } from './youtube.service';

/**
 * Facebook and YouTube used to accept any base64 `{projectId}` as state, so a
 * forged callback could attach an attacker's account to another customer's
 * project. Only a state this server signed is accepted now.
 */
describe('Facebook / YouTube OAuth state', () => {
  const forged = Buffer.from(JSON.stringify({ projectId: 'victim_project' })).toString('base64');
  let prisma: any;

  beforeEach(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-oauth-state-signing';
    prisma = {
      integration: { upsert: jest.fn() },
      project: { findUnique: jest.fn().mockResolvedValue({ organizationId: 'org_other' }) },
      organizationMember: { findUnique: jest.fn().mockResolvedValue(null) },
    };
  });

  it('Facebook rejects an unsigned state before storing anything', async () => {
    await expect(new FacebookService(prisma).handleCallback('code', forged)).rejects.toThrow();
    expect(prisma.integration.upsert).not.toHaveBeenCalled();
  });

  it('YouTube rejects an unsigned state before storing anything', async () => {
    await expect(new YoutubeService(prisma).handleCallback('code', forged)).rejects.toThrow();
    expect(prisma.integration.upsert).not.toHaveBeenCalled();
  });

  it("will not issue a connect link for another organization's project", async () => {
    await expect(new FacebookService(prisma).getAuthUrl('victim_project', 'user_1')).rejects.toThrow('Project not found');
    await expect(new YoutubeService(prisma).getAuthUrl('victim_project', 'user_1')).rejects.toThrow('Project not found');
  });
});
