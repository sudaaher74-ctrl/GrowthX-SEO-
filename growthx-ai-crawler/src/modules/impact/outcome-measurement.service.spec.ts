import { OutcomeMeasurementService, RateResult } from './outcome-measurement.service';

describe('OutcomeMeasurementService', () => {
  let service: OutcomeMeasurementService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      fixIntervention: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      promptCheck: {
        count: jest.fn(),
      },
      interventionOutcome: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'outcome-1' }),
        update: jest.fn().mockResolvedValue({ id: 'outcome-1' }),
      },
    };
    service = new OutcomeMeasurementService(mockPrisma);
  });

  describe('calculateLift (difference-in-differences)', () => {
    it('computes difference-in-differences against a hand-computed fixture', () => {
      const treatPre: RateResult = { rate: 0.1, sampleSize: 20 };
      const treatPost: RateResult = { rate: 0.25, sampleSize: 20 };
      const controlPre: RateResult = { rate: 0.1, sampleSize: 15 };
      const controlPost: RateResult = { rate: 0.12, sampleSize: 15 };

      // treatDelta = 0.25 - 0.10 = 0.15
      // controlDelta = 0.12 - 0.10 = 0.02
      // lift = 0.15 - 0.02 = 0.13
      const lift = service.calculateLift(
        { pre: treatPre, post: treatPost },
        { pre: controlPre, post: controlPost },
      );

      expect(lift).toBe(0.13);
    });

    it('returns null when there is no control arm', () => {
      const treat = {
        pre: { rate: 0.1, sampleSize: 20 },
        post: { rate: 0.3, sampleSize: 20 },
      };

      const lift = service.calculateLift(treat, null);
      expect(lift).toBeNull();
    });

    it('returns null when any sample size is below the floor (< 5)', () => {
      const treat = {
        pre: { rate: 0.1, sampleSize: 20 },
        post: { rate: 0.3, sampleSize: 20 },
      };
      // Control post sample size is 4 (< 5)
      const control = {
        pre: { rate: 0.1, sampleSize: 10 },
        post: { rate: 0.12, sampleSize: 4 },
      };

      const lift = service.calculateLift(treat, control, 5);
      expect(lift).toBeNull();
    });

    it('returns null when treat sample size is below floor', () => {
      const treat = {
        pre: { rate: 0.1, sampleSize: 3 },
        post: { rate: 0.3, sampleSize: 20 },
      };
      const control = {
        pre: { rate: 0.1, sampleSize: 10 },
        post: { rate: 0.12, sampleSize: 10 },
      };

      const lift = service.calculateLift(treat, control, 5);
      expect(lift).toBeNull();
    });
  });

  describe('measureDue duplicate guard and hold promotion', () => {
    it('updates existing outcome instead of creating duplicate for (intervention, assistant, windowDays)', async () => {
      const shippedAt = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
      mockPrisma.fixIntervention.findMany.mockImplementation((args: any) => {
        if (args?.where?.arm === 'TREAT') {
          return Promise.resolve([
            {
              id: 'int-1',
              projectId: 'proj-1',
              changeClass: 'METADATA',
              arm: 'TREAT',
              shippedAt,
            },
          ]);
        }
        if (args?.where?.arm === 'HOLD') {
          return Promise.resolve([{ id: 'hold-1' }]);
        }
        return Promise.resolve([]);
      });

      // Existing record exists
      mockPrisma.interventionOutcome.findFirst.mockResolvedValue({ id: 'existing-outcome-123' });
      mockPrisma.promptCheck.count.mockResolvedValue(10);

      const recorded = await service.measureDue(30);

      expect(mockPrisma.interventionOutcome.update).toHaveBeenCalled();
      expect(mockPrisma.interventionOutcome.create).not.toHaveBeenCalled();
      expect(recorded).toBe(0); // 0 new rows created, existing updated
    });

    it('promotes expired HOLD interventions when their window closes', async () => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const promoted = await service.promoteExpiredHolds(cutoff);
      expect(mockPrisma.fixIntervention.updateMany).toHaveBeenCalledWith({
        where: {
          arm: 'HOLD',
          shippedAt: null,
          createdAt: { lte: cutoff },
        },
        data: {
          shippedAt: expect.any(Date),
        },
      });
      expect(promoted).toBe(2);
    });
  });
});
