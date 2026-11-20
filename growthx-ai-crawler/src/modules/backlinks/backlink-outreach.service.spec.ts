import { BacklinkOutreachService } from './backlink-outreach.service';

describe('BacklinkOutreachService', () => {
  let prisma: any;
  let service: BacklinkOutreachService;

  beforeEach(() => {
    prisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'proj_1',
          name: 'MilquuFresh',
          websites: [{ domain: 'milquufresh.in' }],
        }),
      },
      backlinkOutreachItem: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        upsert: jest.fn().mockImplementation(async ({ create }: any) => ({
          id: 'out_1',
          ...create,
          lastContactedAt: null,
          recoveredAt: null,
          createdAt: new Date('2026-11-19T12:00:00Z'),
          updatedAt: new Date('2026-11-19T12:00:00Z'),
        })),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'out_1',
          projectId: 'proj_1',
          kind: 'LOST_LINK_RECOVERY',
          sourceUrl: 'https://blog.example.org/dairy',
          sourceDomain: 'blog.example.org',
          targetUrl: 'https://milquufresh.in/',
          ...data,
          createdAt: new Date('2026-11-19T12:00:00Z'),
          updatedAt: new Date('2026-11-19T12:05:00Z'),
        })),
        delete: jest.fn().mockResolvedValue({}),
      },
      backlink: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      fixImpactLedgerEvent: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    service = new BacklinkOutreachService(prisma as any);
  });

  it('drafts a grounded lost-link recovery email citing the exact source and target URLs', async () => {
    const draft = await service.createOrDraftItem('proj_1', {
      kind: 'LOST_LINK_RECOVERY',
      sourceUrl: 'https://blog.example.org/dairy',
      targetUrl: 'https://milquufresh.in/a2-milk',
    });

    expect(draft.status).toBe('DRAFTED');
    expect(draft.sourceDomain).toBe('blog.example.org');
    expect(draft.emailDraft).toContain('https://blog.example.org/dairy');
    expect(draft.emailDraft).toContain('https://milquufresh.in/a2-milk');
  });

  it('logs a BACKLINK_RECOVERED FixImpactLedgerEvent when an outreach item is marked RECOVERED', async () => {
    prisma.backlinkOutreachItem.findFirst.mockResolvedValue({
      id: 'out_1',
      projectId: 'proj_1',
      kind: 'LOST_LINK_RECOVERY',
      sourceUrl: 'https://blog.example.org/dairy',
      sourceDomain: 'blog.example.org',
      targetUrl: 'https://milquufresh.in/',
      status: 'CONTACTED',
      lastContactedAt: new Date(),
      recoveredAt: null,
    });

    await service.updateItem('proj_1', 'out_1', { status: 'RECOVERED' });

    expect(prisma.fixImpactLedgerEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: 'proj_1',
          eventType: 'BACKLINK_RECOVERED',
        }),
      }),
    );
  });
});
