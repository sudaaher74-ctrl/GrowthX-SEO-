import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { FindingLifecycle } from '@prisma/client';
import { LifecycleService } from './lifecycle.service';
import { PrismaService } from '../../database/prisma.service';

describe('LifecycleService', () => {
  let service: LifecycleService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      growthOpportunity: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };
    service = new LifecycleService(mockPrisma as unknown as PrismaService);
  });

  describe('transition', () => {
    it('throws NotFoundException if finding does not exist', async () => {
      mockPrisma.growthOpportunity.findUnique.mockResolvedValue(null);

      await expect(
        service.transition('non-existent', FindingLifecycle.QUEUED, { type: 'SYSTEM' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects illegal transition with 409 ConflictException naming both states', async () => {
      mockPrisma.growthOpportunity.findUnique.mockResolvedValue({
        id: 'opp-1',
        lifecycle: FindingLifecycle.DETECTED,
        transitions: [],
      });

      await expect(
        service.transition('opp-1', FindingLifecycle.APPROVED, { type: 'USER', id: 'user-1' }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.transition('opp-1', FindingLifecycle.APPROVED, { type: 'USER', id: 'user-1' }),
      ).rejects.toThrow(/from DETECTED to APPROVED/);
    });

    it('requires a non-empty reason when transitioning to DISMISSED', async () => {
      mockPrisma.growthOpportunity.findUnique.mockResolvedValue({
        id: 'opp-1',
        lifecycle: FindingLifecycle.QUEUED,
        transitions: [],
      });

      await expect(
        service.transition('opp-1', FindingLifecycle.DISMISSED, { type: 'USER' }, { reason: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('requires snoozeUntil when transitioning to SNOOZED', async () => {
      mockPrisma.growthOpportunity.findUnique.mockResolvedValue({
        id: 'opp-1',
        lifecycle: FindingLifecycle.QUEUED,
        transitions: [],
      });

      await expect(
        service.transition('opp-1', FindingLifecycle.SNOOZED, { type: 'USER' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('appends to transitions array and dual-writes legacy status for APPROVED', async () => {
      const existingTransitions = [
        { from: 'DETECTED', to: 'QUEUED', at: '2026-09-01T00:00:00.000Z', actor: { type: 'SYSTEM' } },
      ];

      mockPrisma.growthOpportunity.findUnique.mockResolvedValue({
        id: 'opp-1',
        lifecycle: FindingLifecycle.QUEUED,
        status: 'OPEN',
        transitions: existingTransitions,
      });

      mockPrisma.growthOpportunity.update.mockImplementation(({ data }: any) => ({
        id: 'opp-1',
        ...data,
      }));

      const result = await service.transition(
        'opp-1',
        FindingLifecycle.APPROVED,
        { type: 'USER', id: 'user-42' },
        { reason: 'Approved by admin' },
      );

      expect(mockPrisma.growthOpportunity.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'opp-1' },
          data: expect.objectContaining({
            lifecycle: FindingLifecycle.APPROVED,
            status: 'ACTIONED',
            transitions: expect.arrayContaining([
              ...existingTransitions,
              expect.objectContaining({
                from: FindingLifecycle.QUEUED,
                to: FindingLifecycle.APPROVED,
                actor: { type: 'USER', id: 'user-42' },
                reason: 'Approved by admin',
              }),
            ]),
          }),
        }),
      );

      expect(result.lifecycle).toBe(FindingLifecycle.APPROVED);
      expect(result.status).toBe('ACTIONED');
    });

    it('updates resolvedAt when transitioning to RESOLVED', async () => {
      mockPrisma.growthOpportunity.findUnique.mockResolvedValue({
        id: 'opp-1',
        lifecycle: FindingLifecycle.QUEUED,
        status: 'OPEN',
        transitions: [],
      });

      mockPrisma.growthOpportunity.update.mockImplementation(({ data }: any) => ({
        id: 'opp-1',
        ...data,
      }));

      await service.transition('opp-1', FindingLifecycle.RESOLVED, { type: 'SYSTEM' });

      expect(mockPrisma.growthOpportunity.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lifecycle: FindingLifecycle.RESOLVED,
            status: 'OPEN',
            resolvedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('wakeSnoozedFindings', () => {
    it('wakes findings past snoozeUntil and transitions them to QUEUED', async () => {
      mockPrisma.growthOpportunity.findMany.mockResolvedValue([
        { id: 'opp-snoozed-1' },
        { id: 'opp-snoozed-2' },
      ]);

      mockPrisma.growthOpportunity.findUnique.mockImplementation(({ where }: any) => ({
        id: where.id,
        lifecycle: FindingLifecycle.SNOOZED,
        transitions: [],
      }));

      mockPrisma.growthOpportunity.update.mockResolvedValue({});

      const res = await service.wakeSnoozedFindings(new Date('2026-09-23T12:00:00.000Z'));

      expect(res.awakened).toBe(2);
      expect(mockPrisma.growthOpportunity.update).toHaveBeenCalledTimes(2);
    });
  });
});
