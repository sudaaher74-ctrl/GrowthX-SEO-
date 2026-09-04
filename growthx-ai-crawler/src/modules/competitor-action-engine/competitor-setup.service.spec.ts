import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CompetitorSetupService, MAX_COMPETITORS, youtubeHandle } from './competitor-setup.service';

describe('CompetitorSetupService', () => {
  let prisma: any;
  let service: CompetitorSetupService;

  beforeEach(() => {
    prisma = {
      competitorDomain: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue({ id: 'c1', domain: 'acme.com' }),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'new', ...data })),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'c1', ...data })),
        delete: jest.fn().mockResolvedValue({}),
      },
      competitorAccount: {
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    service = new CompetitorSetupService(prisma);
  });

  it('stores a competitor with every platform identity given', async () => {
    const created: any = await service.create('org1', 'p1', {
      businessName: 'Country Delight',
      websiteUrl: 'https://www.countrydelight.in/pricing',
      mapsName: 'Country Delight Mumbai',
      youtubeUrl: 'https://youtube.com/@countrydelight',
      instagramHandle: 'countrydelight',
      industry: 'Dairy',
      city: 'Mumbai',
    });

    // The URL is reduced to the domain that identifies the company.
    expect(created.domain).toBe('countrydelight.in');
    expect(created.mapsName).toBe('Country Delight Mumbai');
    expect(created.city).toBe('Mumbai');
    // A new competitor must not claim to have been analysed.
    expect(created.status).toBeUndefined();
    expect(created.lastAnalyzedAt).toBeUndefined();
  });

  it('accepts a handle however it was pasted', async () => {
    const fromUrl: any = await service.create('org1', 'p1', {
      websiteUrl: 'acme.com',
      instagramHandle: 'https://www.instagram.com/acmedairy/',
    });
    expect(fromUrl.instagramHandle).toBe('@acmedairy');

    const bare: any = await service.create('org1', 'p1', { websiteUrl: 'acme2.com', instagramHandle: 'acmedairy' });
    expect(bare.instagramHandle).toBe('@acmedairy');
  });

  it('refuses a sixth competitor rather than silently dropping it', async () => {
    prisma.competitorDomain.count.mockResolvedValue(MAX_COMPETITORS);

    await expect(service.create('org1', 'p1', { websiteUrl: 'sixth.com' })).rejects.toThrow(BadRequestException);
  });

  it('refuses a competitor already tracked', async () => {
    prisma.competitorDomain.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(service.create('org1', 'p1', { websiteUrl: 'acme.com' })).rejects.toThrow(/already tracked/);
  });

  it('refuses a website that is not one', async () => {
    await expect(service.create('org1', 'p1', { websiteUrl: 'not a url' })).rejects.toThrow(BadRequestException);
  });

  it('will not repoint a competitor at a different company', async () => {
    // The domain anchors every crawl and finding; changing it would attribute
    // one company's history to another.
    await expect(
      service.update('org1', 'p1', 'c1', { websiteUrl: 'https://globex.com' }),
    ).rejects.toThrow(/cannot be changed/);
  });

  it('edits everything else in place', async () => {
    const updated: any = await service.update('org1', 'p1', 'c1', { city: 'Pune', mapsName: 'Acme Pune' });

    expect(updated.city).toBe('Pune');
    expect(updated.mapsName).toBe('Acme Pune');
  });

  it('accepts the unchanged website on an edit', async () => {
    await expect(
      service.update('org1', 'p1', 'c1', { websiteUrl: 'https://www.acme.com/about', city: 'Pune' }),
    ).resolves.toBeDefined();
  });

  it('refuses to touch a competitor from another project', async () => {
    prisma.competitorDomain.findFirst.mockResolvedValue(null);

    await expect(service.update('org1', 'p1', 'other', { city: 'Pune' })).rejects.toThrow(NotFoundException);
    await expect(service.remove('p1', 'other')).rejects.toThrow(NotFoundException);
  });

  it('registers the handles typed in the form as syncable accounts', async () => {
    // Without this the fields were decorative: content ingestion iterates
    // CompetitorAccount, and nothing turned a hand-entered handle into one.
    await service.create('org1', 'p1', {
      websiteUrl: 'countrydelight.in',
      youtubeUrl: 'https://www.youtube.com/@countrydelight',
      instagramHandle: 'countrydelight',
    });

    const platforms = prisma.competitorAccount.upsert.mock.calls.map(
      (call: any[]) => call[0].create.platform,
    );
    expect(platforms.sort()).toEqual(['INSTAGRAM', 'YOUTUBE']);
    expect(prisma.competitorAccount.upsert.mock.calls[0][0].create.handle).toBe('@countrydelight');
    expect(prisma.competitorAccount.upsert.mock.calls[0][0].create.discoverySource).toBe('MANUAL');
  });

  it('creates no account for a platform left blank', async () => {
    await service.create('org1', 'p1', { websiteUrl: 'acme.com' });

    expect(prisma.competitorAccount.upsert).not.toHaveBeenCalled();
  });

  it('deactivates a handle the operator removed rather than deleting its history', async () => {
    prisma.competitorDomain.update.mockResolvedValue({
      id: 'c1',
      domain: 'acme.com',
      name: 'Acme',
      youtubeUrl: null,
      instagramHandle: null,
    });

    await service.update('org1', 'p1', 'c1', { youtubeUrl: '', instagramHandle: '' });

    expect(prisma.competitorAccount.upsert).not.toHaveBeenCalled();
    const deactivate = prisma.competitorAccount.updateMany.mock.calls[0][0];
    expect(deactivate.data).toEqual({ isActive: false });
    expect(deactivate.where.discoverySource).toBe('MANUAL');
  });

  it('reports how many slots are left', async () => {
    prisma.competitorDomain.findMany.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

    const result = await service.list('p1');

    expect(result.slotsUsed).toBe(2);
    expect(result.slotsTotal).toBe(MAX_COMPETITORS);
  });
});

describe('youtubeHandle', () => {
  it('reads a channel out of every shape it gets pasted in', () => {
    expect(youtubeHandle('https://www.youtube.com/@countrydelight')).toBe('@countrydelight');
    expect(youtubeHandle('https://youtube.com/channel/UCabc123')).toBe('UCabc123');
    expect(youtubeHandle('https://youtube.com/c/LegacyName')).toBe('LegacyName');
    expect(youtubeHandle('@countrydelight')).toBe('@countrydelight');
    expect(youtubeHandle('countrydelight')).toBe('@countrydelight');
  });

  it('returns nothing rather than guessing at a URL it cannot read', () => {
    expect(youtubeHandle('')).toBeNull();
    expect(youtubeHandle(null)).toBeNull();
    expect(youtubeHandle('https://example.com/some/path')).toBeNull();
  });
});
