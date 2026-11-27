import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FindingLifecycle } from '@prisma/client';
import { ManualVerificationService } from './manual-verification.service';
import { PrismaService } from '../../database/prisma.service';
import { publicAxios } from '../security/ssrf';

jest.mock('../security/ssrf', () => {
  const actual = jest.requireActual('../security/ssrf');
  return {
    ...actual,
    publicAxios: {
      get: jest.fn(),
    },
  };
});

describe('ManualVerificationService', () => {
  let service: ManualVerificationService;
  let prisma: any;
  const mockGet = publicAxios.get as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      growthOpportunity: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'finding-1',
          projectId: 'proj-1',
          title: 'Missing meta description and LocalBusiness JSON-LD schema',
          summary: 'Homepage lacks meta description and structured data.',
          recommendedAction: 'Add meta description and LocalBusiness JSON-LD.',
          source: 'WEBSITE',
          affectedPages: ['https://example.com/'],
          lifecycle: FindingLifecycle.DETECTED,
          transitions: [],
        }),
        update: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ id: 'finding-1', ...data }),
        ),
      },
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'proj-1',
          websites: [{ domain: 'example.com' }],
        }),
      },
      fixSnapshot: {
        create: jest.fn().mockResolvedValue({ id: 'snap-1' }),
      },
      fixImpactLedgerEvent: {
        create: jest.fn().mockResolvedValue({ id: 'ledger-1' }),
      },
    };
    service = new ManualVerificationService(prisma as unknown as PrismaService);
  });

  it('throws NotFoundException when finding does not belong to project', async () => {
    prisma.growthOpportunity.findFirst.mockResolvedValue(null);
    await expect(
      service.verifyManualFix('proj-1', 'missing-id', { type: 'USER', id: 'u1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('blocks private/localhost URLs via SSRF protection', async () => {
    await expect(
      service.verifyManualFix('proj-1', 'finding-1', { type: 'USER', id: 'u1' }, {
        url: 'http://127.0.0.1:3000/admin',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('refuses to mark verified when live HTML is still missing required signals', async () => {
    mockGet.mockResolvedValue({
      status: 200,
      data: '<html><head><title>Example Home</title></head><body><h1>Example</h1></body></html>',
    });

    const result = await service.verifyManualFix('proj-1', 'finding-1', { type: 'USER', id: 'u1' });

    expect(result.verified).toBe(false);
    expect(result.lifecycle).toBe(FindingLifecycle.DETECTED);
    expect(result.ledgerEventId).toBeNull();
    expect(prisma.growthOpportunity.update).not.toHaveBeenCalled();
    expect(prisma.fixImpactLedgerEvent.create).not.toHaveBeenCalled();
    expect(result.checks.some((c) => !c.passed && c.name.includes('Meta description'))).toBe(true);
    expect(result.checks.some((c) => !c.passed && c.name.includes('JSON-LD'))).toBe(true);
  });

  it('records VERIFIED_LIVE snapshot, ledger event, and transitions finding when live checks pass', async () => {
    mockGet.mockResolvedValue({
      status: 200,
      data: `<!doctype html><html><head>
        <title>Example Bakery — Fresh Bread Delivered Daily</title>
        <meta name="description" content="Order freshly baked artisan sourdough and pastries delivered every morning across downtown.">
        <link rel="canonical" href="https://example.com/">
        <script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Example Bakery"}</script>
      </head><body><h1>Fresh Artisan Bakery</h1></body></html>`,
    });

    const result = await service.verifyManualFix('proj-1', 'finding-1', { type: 'USER', id: 'u1' }, {
      note: 'Updated meta description and LocalBusiness schema in CMS',
    });

    expect(result.verified).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.lifecycle).toBe(FindingLifecycle.VERIFIED);
    expect(result.ledgerEventId).toBe('ledger-1');
    expect(result.observed?.jsonLdTypes).toEqual(['LocalBusiness']);
    expect(prisma.fixSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          url: 'https://example.com/',
          snapshotType: 'VERIFIED_LIVE',
        }),
      }),
    );
    expect(prisma.fixImpactLedgerEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj-1',
          eventType: 'TECHNICAL_FIX_CONFIRMED',
          verificationStatus: 'VERIFIED_LIVE',
        }),
      }),
    );
    expect(prisma.growthOpportunity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'finding-1' },
        data: expect.objectContaining({
          lifecycle: FindingLifecycle.VERIFIED,
          status: 'ACTIONED',
        }),
      }),
    );
  });

  it('refuses verification when finding lacks actionable single-URL live rules (no blind 200 pass)', async () => {
    prisma.growthOpportunity.findFirst.mockResolvedValue({
      id: 'finding-generic',
      projectId: 'proj-1',
      title: 'Site-wide orphan pages detected across blog taxonomy',
      summary: 'Cross-site orphan issue with no single-URL verifiable rule',
      recommendedAction: 'Internal linking architecture reorganization across site',
      source: 'WEBSITE',
      affectedPages: ['https://example.com/blog/'],
      lifecycle: FindingLifecycle.DETECTED,
      transitions: [],
    });
    mockGet.mockResolvedValue({
      status: 200,
      data: '<html><head><title>Blog</title></head><body><h1>Blog</h1></body></html>',
    });

    const result = await service.verifyManualFix('proj-1', 'finding-generic', { type: 'USER', id: 'u1' });

    expect(result.verified).toBe(false);
    expect(result.checks.some((c) => !c.passed && c.name === 'Fix-specific live check')).toBe(true);
    expect(result.checks.find((c) => c.name === 'Fix-specific live check')?.observed).toContain('Automatic single-URL verification is not supported');
  });

  it('fails verification when live page has conflicting multiple title tags', async () => {
    prisma.growthOpportunity.findFirst.mockResolvedValue({
      id: 'finding-title',
      projectId: 'proj-1',
      title: 'Missing title tag or title too short',
      summary: 'Homepage lacks unique title',
      recommendedAction: 'Add title tag',
      source: 'WEBSITE',
      affectedPages: ['https://example.com/'],
      lifecycle: FindingLifecycle.DETECTED,
      transitions: [],
    });
    mockGet.mockResolvedValue({
      status: 200,
      data: `<!doctype html><html><head>
        <title>Old Static Shell Title</title>
        <title>New Hydrated Sourdough Title</title>
        <meta name="description" content="Order freshly baked artisan sourdough and pastries delivered every morning across downtown.">
        <link rel="canonical" href="https://example.com/">
        <script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Example Bakery"}</script>
      </head><body><h1>Fresh Bakery</h1></body></html>`,
    });

    const result = await service.verifyManualFix('proj-1', 'finding-title', { type: 'USER', id: 'u1' });

    expect(result.verified).toBe(false);
    const titleCheck = result.checks.find((c) => c.name.includes('<title>'));
    expect(titleCheck).toBeDefined();
    expect(titleCheck?.passed).toBe(false);
    expect(titleCheck?.observed).toContain('Conflicting <title> tags (2)');
  });

  it('fails verification when live page has conflicting multiple canonical tags', async () => {
    prisma.growthOpportunity.findFirst.mockResolvedValue({
      id: 'finding-canonical',
      projectId: 'proj-1',
      title: 'Canonical URL missing or incorrect',
      summary: 'Needs explicit self canonical',
      recommendedAction: 'Add canonical tag',
      source: 'WEBSITE',
      affectedPages: ['https://example.com/page'],
      lifecycle: FindingLifecycle.DETECTED,
      transitions: [],
    });
    mockGet.mockResolvedValue({
      status: 200,
      data: `<!doctype html><html><head>
        <title>Example Page</title>
        <link rel="canonical" href="https://example.com/page">
        <link rel="canonical" href="https://example.com/other-page">
      </head><body><h1>Example</h1></body></html>`,
    });

    const result = await service.verifyManualFix('proj-1', 'finding-canonical', { type: 'USER', id: 'u1' });

    expect(result.verified).toBe(false);
    const canonCheck = result.checks.find((c) => c.name.includes('Canonical'));
    expect(canonCheck).toBeDefined();
    expect(canonCheck?.passed).toBe(false);
    expect(canonCheck?.observed).toContain('Conflicting canonical targets (2)');
  });
});
