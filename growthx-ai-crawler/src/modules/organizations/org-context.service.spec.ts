import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrgContextService } from './org-context.service';

describe('OrgContextService', () => {
  let service: OrgContextService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      organizationMember: { findUnique: jest.fn().mockResolvedValue({ id: 'm1' }) },
      website: { findUnique: jest.fn() },
      crawlJob: { findUnique: jest.fn() },
    };
    service = new OrgContextService(prisma);
  });

  describe('assertMembership', () => {
    it('passes a member through', async () => {
      await expect(service.assertMembership('user_1', 'org_1')).resolves.toBeUndefined();
    });

    it('refuses a caller who is not a member', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(null);
      await expect(service.assertMembership('user_1', 'org_2')).rejects.toThrow(ForbiddenException);
    });

    // An unauthenticated request must not read as "no membership required".
    it('refuses when there is no authenticated user', async () => {
      await expect(service.assertMembership(undefined as any, 'org_1')).rejects.toThrow(ForbiddenException);
      expect(prisma.organizationMember.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('requireOwner', () => {
    it('returns the owning organization', () => {
      expect(service.requireOwner('org_1', 'website')).toBe('org_1');
    });

    // A record with no organization above it is not a free-for-all.
    it('refuses a record with no owning organization', () => {
      expect(() => service.requireOwner(null, 'website')).toThrow(ForbiddenException);
      expect(() => service.requireOwner(undefined, 'crawl job')).toThrow(ForbiddenException);
    });
  });

  describe('assertWebsiteAccess', () => {
    it('returns the website when the caller belongs to its organization', async () => {
      prisma.website.findUnique.mockResolvedValue({
        id: 'w1',
        domain: 'example.com',
        verificationToken: 't',
        project: { organizationId: 'org_1' },
      });
      await expect(service.assertWebsiteAccess('user_1', { domain: 'example.com' })).resolves.toMatchObject({ id: 'w1' });
    });

    it('refuses a website belonging to another organization', async () => {
      prisma.website.findUnique.mockResolvedValue({ id: 'w1', project: { organizationId: 'org_2' } });
      prisma.organizationMember.findUnique.mockResolvedValue(null);
      await expect(service.assertWebsiteAccess('user_1', { domain: 'example.com' })).rejects.toThrow(ForbiddenException);
    });

    it('404s on a website that does not exist', async () => {
      prisma.website.findUnique.mockResolvedValue(null);
      await expect(service.assertWebsiteAccess('user_1', { domain: 'nope.com' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('assertCrawlJobAccess', () => {
    it('refuses a crawl job belonging to another organization', async () => {
      prisma.crawlJob.findUnique.mockResolvedValue({ id: 'j1', website: { project: { organizationId: 'org_2' } } });
      prisma.organizationMember.findUnique.mockResolvedValue(null);
      await expect(service.assertCrawlJobAccess('user_1', 'j1')).rejects.toThrow(ForbiddenException);
    });
  });
});
