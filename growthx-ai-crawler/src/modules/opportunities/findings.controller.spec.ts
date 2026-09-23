import { NotFoundException } from '@nestjs/common';
import { FindingLifecycle } from '@prisma/client';
import { FindingsController } from './findings.controller';
import { PrismaService } from '../../database/prisma.service';
import { FindingSyncService } from './finding-sync.service';
import { LifecycleService } from './lifecycle.service';

describe('FindingsController', () => {
  let controller: FindingsController;
  let mockPrisma: any;
  let mockSyncService: any;
  let mockLifecycleService: any;

  beforeEach(() => {
    mockPrisma = {
      project: {
        findFirst: jest.fn().mockResolvedValue({ id: 'proj-1' }),
      },
      growthOpportunity: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'finding-1',
            impact: 90,
            detectedAt: new Date('2026-09-01'),
            source: 'WEBSITE',
            fixClass: 'AUTO',
          },
        ]),
        groupBy: jest.fn().mockImplementation(({ by }: any) => {
          if (by.includes('source')) {
            return Promise.resolve([{ source: 'WEBSITE', _count: { _all: 1 } }]);
          }
          if (by.includes('fixClass')) {
            return Promise.resolve([{ fixClass: 'AUTO', _count: { _all: 1 } }]);
          }
          return Promise.resolve([]);
        }),
        count: jest.fn().mockResolvedValue(1),
        findFirst: jest.fn(),
      },
    };

    mockSyncService = {
      syncProject: jest.fn().mockResolvedValue({ created: 1, updated: 0, resolved: 0 }),
    };

    mockLifecycleService = {
      transition: jest.fn().mockResolvedValue({ id: 'finding-1', lifecycle: FindingLifecycle.APPROVED }),
    };

    controller = new FindingsController(
      mockPrisma as unknown as PrismaService,
      mockSyncService as unknown as FindingSyncService,
      mockLifecycleService as unknown as LifecycleService,
    );
  });

  describe('list', () => {
    it('returns ranked findings with nextCursor and counts', async () => {
      const res = await controller.list(
        { organizationId: 'org-1' },
        'proj-1',
        'OPEN',
        undefined,
        undefined,
        undefined,
        undefined,
        '50',
      );

      expect(res.items).toHaveLength(1);
      expect(res.nextCursor).toBeNull();
      expect(res.counts.total).toBe(1);
      expect(res.counts.bySource).toEqual({ WEBSITE: 1 });
      expect(res.counts.byFixClass).toEqual({ AUTO: 1 });
    });

    it('rejects access if project not owned by organization', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      await expect(
        controller.list({ organizationId: 'org-other' }, 'proj-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('sync', () => {
    it('calls syncProject and returns result', async () => {
      const res = await controller.sync({ organizationId: 'org-1' }, 'proj-1');
      expect(res).toEqual({ created: 1, updated: 0, resolved: 0 });
      expect(mockSyncService.syncProject).toHaveBeenCalledWith('proj-1');
    });
  });

  describe('transition', () => {
    it('calls lifecycleService.transition with provided parameters', async () => {
      const res = await controller.transition(
        { organizationId: 'org-1', user: { id: 'user-1' } },
        'proj-1',
        'finding-1',
        { to: FindingLifecycle.APPROVED, reason: 'Approved fix' },
      );

      expect(res.lifecycle).toBe(FindingLifecycle.APPROVED);
      expect(mockLifecycleService.transition).toHaveBeenCalledWith(
        'finding-1',
        FindingLifecycle.APPROVED,
        { type: 'USER', id: 'user-1' },
        { reason: 'Approved fix', snoozeUntil: undefined },
      );
    });
  });
});
