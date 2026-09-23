import { GbpAdapter } from './gbp.adapter';
import { PrismaService } from '../../database/prisma.service';

describe('GbpAdapter', () => {
  let adapter: GbpAdapter;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findUnique: jest.fn().mockResolvedValue({ organizationId: 'org-1' }),
      },
      gbpFixProposal: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'proposal-123',
            projectId: 'proj-1',
            field: 'description',
            currentValue: 'Old text',
            proposedValue: 'New high-converting description',
            rationale: 'Missing keywords for local search',
            status: 'PENDING',
          },
        ]),
      },
      localLocation: {
        findFirst: jest.fn().mockResolvedValue({ id: 'loc-primary' }),
      },
    };

    adapter = new GbpAdapter(mockPrisma as unknown as PrismaService);
  });

  it('produces stable fingerprints across two invocations with identical inputs', async () => {
    const run1 = await adapter.collect('proj-1');
    const run2 = await adapter.collect('proj-1');

    expect(run1).toHaveLength(1);
    expect(run2).toHaveLength(1);
    expect(run1[0].fingerprint).toBe(run2[0].fingerprint);
    expect(run1[0].fingerprint).toBe('proj-1::GBP::description::loc-primary');
    expect(run1[0].fixClass).toBe('APPROVAL');
    expect(run1[0].detailType).toBe('GBP_PROPOSAL');
    expect(run1[0].detailRef).toBe('proposal-123');
  });
});
