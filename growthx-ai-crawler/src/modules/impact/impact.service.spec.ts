import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AiAssistant, ChangeClass, InterventionArm } from '@prisma/client';
import { ImpactService } from './impact.service';

/**
 * The distinction these tests exist to protect: a before-and-after difference
 * is not an effect. Citation moves on its own, so a page that gained citation
 * after a fix may have gained it anyway. Reporting the raw delta as though it
 * were caused by the change is the mistake every vendor in this category is
 * currently making, and it is a mistake the code has to make impossible rather
 * than leave to whoever writes the report.
 */
describe('ImpactService', () => {
  const shippedAt = new Date('2026-06-01T00:00:00Z');

  function build(options: {
    intervention?: any;
    holds?: { url: string }[];
    /** [preTotal, preCited, postTotal, postCited] for the treated project. */
    project?: [number, number, number, number];
    /** Checks returned for the hold-arm rate. */
    holdChecks?: { cited: boolean; citedUrl: string | null }[];
    existingOutcome?: { id: string } | null;
  } = {}) {
    const [preTotal, preCited, postTotal, postCited] = options.project ?? [100, 10, 100, 20];
    const holds = options.holds ?? [];

    let countCall = 0;
    const promptCheckCount = jest.fn().mockImplementation(async ({ where }: any) => {
      // Order: pre total, pre cited, post total, post cited.
      const sequence = [preTotal, preCited, postTotal, postCited];
      const value = sequence[countCall % 4];
      countCall++;
      void where;
      return value;
    });

    const prisma = {
      fixIntervention: {
        findUnique: jest.fn().mockResolvedValue(
          'intervention' in options
            ? options.intervention
            : {
                id: 'int-1',
                projectId: 'p1',
                url: 'https://example.com/dentists',
                changeClass: ChangeClass.SCHEMA_MARKUP,
                arm: InterventionArm.TREAT,
                shippedAt,
              },
        ),
        count: jest.fn().mockResolvedValue(holds.length),
        findMany: jest.fn().mockResolvedValue(holds),
        create: jest.fn(async ({ data }: any) => ({ id: 'int-new', ...data })),
        update: jest.fn(async ({ data }: any) => ({ id: 'int-1', ...data })),
      },
      promptCheck: {
        count: promptCheckCount,
        findMany: jest.fn().mockResolvedValue(options.holdChecks ?? []),
      },
      interventionOutcome: {
        findFirst: jest.fn().mockResolvedValue(options.existingOutcome ?? null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    return { service: new ImpactService(prisma as any), prisma };
  }

  describe('recording', () => {
    it('records a shipped change and a deliberate hold as the same kind of row', async () => {
      const { service, prisma } = build();

      await service.recordIntervention({
        projectId: 'p1',
        url: 'https://example.com/a',
        changeClass: ChangeClass.FAQ_BLOCK,
      });
      await service.recordIntervention({
        projectId: 'p1',
        url: 'https://example.com/b',
        changeClass: ChangeClass.FAQ_BLOCK,
        arm: InterventionArm.HOLD,
      });

      expect(prisma.fixIntervention.create.mock.calls[0][0].data.arm).toBe(InterventionArm.TREAT);
      expect(prisma.fixIntervention.create.mock.calls[1][0].data.arm).toBe(InterventionArm.HOLD);
    });

    it('refuses to ship a page that is in the hold arm', async () => {
      // Shipping a held page silently removes it from the control group, and
      // the comparison it existed to support quietly stops meaning anything.
      const { service } = build({
        intervention: { id: 'int-1', projectId: 'p1', arm: InterventionArm.HOLD, shippedAt: null },
      });

      await expect(service.markShipped('int-1')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.markShipped('int-1')).rejects.toThrow(/control group/);
    });

    it('does not move the ship date when marked shipped twice', async () => {
      const { service, prisma } = build();
      await service.markShipped('int-1');
      expect(prisma.fixIntervention.update.mock.calls[0][0].data.shippedAt).toEqual(shippedAt);
    });

    it('reports a missing intervention rather than measuring nothing', async () => {
      const { service } = build({ intervention: null });
      await expect(service.measure('nope', 30)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('measuring', () => {
    it('refuses to measure a change that has not shipped', async () => {
      const { service } = build({
        intervention: { id: 'int-1', projectId: 'p1', arm: InterventionArm.TREAT, shippedAt: null },
      });
      await expect(service.measure('int-1', 30)).rejects.toThrow(/has not shipped/);
    });

    it('reports an observed change, not a causal estimate, when there are no holds', async () => {
      const { service } = build({ holds: [], project: [100, 10, 100, 20] });

      const result = await service.measure('int-1', 30);

      expect(result.pre.rate).toBe(0.1);
      expect(result.post.rate).toBe(0.2);
      // The raw delta is +10pp, and it is deliberately NOT reported as lift.
      expect(result.lift).toBeNull();
      expect(result.interpretation).toBe('OBSERVED_CHANGE');
    });

    it('nets out the movement the held pages saw anyway', async () => {
      // Treated pages went 10% -> 20% (+10pp). Held pages went 20% -> 26%
      // (+6pp) with no change made at all, so only +4pp is attributable.
      const holdChecks = [
        ...Array.from({ length: 20 }, (_, i) => ({ cited: i < 4, citedUrl: 'https://example.com/held' })),
      ];
      const { service, prisma } = build({
        holds: [{ url: 'https://example.com/held' }],
        project: [100, 10, 100, 20],
        holdChecks,
      });
      prisma.promptCheck.findMany
        .mockResolvedValueOnce(
          Array.from({ length: 20 }, (_, i) => ({ cited: i < 4, citedUrl: 'https://example.com/held' })),
        )
        .mockResolvedValueOnce(
          Array.from({ length: 50 }, (_, i) => ({ cited: i < 13, citedUrl: 'https://example.com/held' })),
        );

      const result = await service.measure('int-1', 30);

      expect(result.control).not.toBeNull();
      expect(result.control!.pre.rate).toBe(0.2);
      expect(result.control!.post.rate).toBe(0.26);
      expect(result.lift).toBeCloseTo(0.04, 4);
      expect(result.interpretation).toBe('CAUSAL_ESTIMATE');
    });

    it('can report a change that only looked like a win', async () => {
      // Treated +10pp, holds +15pp: the page did better than before and worse
      // than doing nothing. A raw before/after would have called this a success.
      const { service, prisma } = build({ holds: [{ url: 'https://example.com/held' }], project: [100, 10, 100, 20] });
      prisma.promptCheck.findMany
        .mockResolvedValueOnce(
          Array.from({ length: 20 }, (_, i) => ({ cited: i < 4, citedUrl: 'https://example.com/held' })),
        )
        .mockResolvedValueOnce(
          Array.from({ length: 20 }, (_, i) => ({ cited: i < 7, citedUrl: 'https://example.com/held' })),
        );

      const result = await service.measure('int-1', 30);
      expect(result.lift).toBeLessThan(0);
    });

    it('says the sample is too small rather than reporting a swing as a result', async () => {
      const { service } = build({ holds: [], project: [4, 0, 4, 2] });

      const result = await service.measure('int-1', 30);
      expect(result.interpretation).toBe('INSUFFICIENT_DATA');
    });

    it('ignores held pages that the answers never mentioned', async () => {
      // Otherwise the "control" is just the whole project again, and the
      // comparison measures nothing.
      const { service, prisma } = build({ holds: [{ url: 'https://example.com/held' }], project: [100, 10, 100, 20] });
      prisma.promptCheck.findMany.mockResolvedValue([
        { cited: true, citedUrl: 'https://example.com/somewhere-else' },
        { cited: false, citedUrl: null },
      ]);

      const result = await service.measure('int-1', 30);
      expect(result.control!.pre.sampleSize).toBe(0);
      expect(result.lift).toBeNull();
    });

    it('measures a single engine separately from the blended figure', async () => {
      const { service, prisma } = build();
      await service.measure('int-1', 30, AiAssistant.PERPLEXITY);

      const where = prisma.promptCheck.count.mock.calls[0][0].where;
      expect(where.assistant).toBe(AiAssistant.PERPLEXITY);
    });

    it('excludes errored checks, which asked nothing and are evidence of nothing', async () => {
      const { service, prisma } = build();
      await service.measure('int-1', 30);

      expect(prisma.promptCheck.count.mock.calls[0][0].where.error).toBeNull();
    });

    it('updates an existing measurement instead of writing a second one', async () => {
      const { service, prisma } = build({ existingOutcome: { id: 'out-1' } });
      await service.measure('int-1', 30);

      expect(prisma.interventionOutcome.update).toHaveBeenCalled();
      expect(prisma.interventionOutcome.create).not.toHaveBeenCalled();
    });
  });

  describe('change-class summary', () => {
    it('labels how much evidence sits behind each estimate', async () => {
      const { service, prisma } = build();
      prisma.interventionOutcome.findMany.mockResolvedValue([
        ...Array.from({ length: 120 }, () => ({
          lift: 0.05,
          intervention: { changeClass: ChangeClass.SCHEMA_MARKUP },
        })),
        ...Array.from({ length: 40 }, () => ({
          lift: 0.03,
          intervention: { changeClass: ChangeClass.FAQ_BLOCK },
        })),
        { lift: 0.2, intervention: { changeClass: ChangeClass.COMPARISON_TABLE } },
      ]);

      const summary = await service.changeClassSummary('p1', 30);

      // The single-sample 20pp result sorts top on magnitude and must not read
      // as a finding.
      expect(summary[0]).toMatchObject({ changeClass: ChangeClass.COMPARISON_TABLE, confidence: 'ANECDOTAL' });
      expect(summary.find((r) => r.changeClass === ChangeClass.SCHEMA_MARKUP)).toMatchObject({
        interventions: 120,
        confidence: 'ESTABLISHED',
      });
      expect(summary.find((r) => r.changeClass === ChangeClass.FAQ_BLOCK)).toMatchObject({
        confidence: 'EMERGING',
      });
    });

    it('counts only shipped, un-rolled-back changes', async () => {
      const { service, prisma } = build();
      await service.changeClassSummary('p1', 30);

      const where = prisma.interventionOutcome.findMany.mock.calls[0][0].where;
      expect(where.intervention).toMatchObject({ arm: InterventionArm.TREAT, rolledBackAt: null });
      expect(where.lift).toEqual({ not: null });
    });
  });
});
