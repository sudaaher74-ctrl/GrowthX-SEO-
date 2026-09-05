import { AnalysisPipelineService } from './analysis-pipeline.service';

describe('AnalysisPipelineService', () => {
  const originalYoutubeKey = process.env.YOUTUBE_API_KEY;
  afterEach(() => {
    if (originalYoutubeKey === undefined) delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY = originalYoutubeKey;
  });

  let prisma: any;
  let scraper: any;
  let ownSocial: any;
  let classification: any;
  let patterns: any;
  let gaps: any;
  let contentStrategy: any;
  let actionEngine: any;
  let service: AnalysisPipelineService;

  beforeEach(() => {
    prisma = {
      project: { findMany: jest.fn().mockResolvedValue([]) },
      competitorAccount: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'a1', handle: '@rival', platform: 'YOUTUBE', organizationId: 'org1' },
        ]),
      },
    };
    process.env.YOUTUBE_API_KEY = 'test-key';
    scraper = {
      syncAccountContent: jest.fn().mockResolvedValue({ platform: 'YOUTUBE', handle: '@rival', fetched: 5, imported: 5 }),
    };
    ownSocial = {
      syncProject: jest.fn().mockResolvedValue({ synced: [{ handle: '@you', imported: 4 }], skipped: [] }),
    };
    classification = { classifyPending: jest.fn().mockResolvedValue({ classified: 7 }) };
    patterns = { detectPatterns: jest.fn().mockResolvedValue({ patternsDetected: 3 }) };
    gaps = { analyzeGaps: jest.fn().mockResolvedValue({ gapsGenerated: 5 }) };
    contentStrategy = { generateStrategy: jest.fn().mockResolvedValue({ title: 'Q4 Content Strategy' }) };
    actionEngine = { generate: jest.fn().mockResolvedValue({ runId: 'r1', status: 'RUNNING' }) };

    service = new AnalysisPipelineService(
      prisma,
      scraper,
      ownSocial,
      classification,
      patterns,
      gaps,
      contentStrategy,
      actionEngine,
    );
  });

  // Each stage refuses to run without the one before it, and its refusal
  // message names that stage. Walking them out of order is the same as not
  // walking them at all.
  it('walks the stages in the order each one depends on', async () => {
    const order: string[] = [];
    scraper.syncAccountContent.mockImplementation(async () => (order.push('collect'), { imported: 1 }));
    ownSocial.syncProject.mockImplementation(async () => (order.push('own'), { synced: [], skipped: [] }));
    classification.classifyPending.mockImplementation(async () => (order.push('classify'), { classified: 1 }));
    patterns.detectPatterns.mockImplementation(async () => (order.push('patterns'), { patternsDetected: 1 }));
    gaps.analyzeGaps.mockImplementation(async () => (order.push('gaps'), { gapsGenerated: 1 }));
    actionEngine.generate.mockImplementation(async () => (order.push('plan'), { runId: 'r1', status: 'RUNNING' }));
    contentStrategy.generateStrategy.mockImplementation(async () => (order.push('strategy'), { title: 'S' }));

    await service.run('org1', 'p1');

    expect(order).toEqual(['collect', 'own', 'classify', 'patterns', 'gaps', 'plan', 'strategy']);
  });

  it('passes the project and organisation the right way round to every stage', async () => {
    await service.run('org1', 'p1');

    expect(classification.classifyPending).toHaveBeenCalledWith('p1', 'org1');
    expect(patterns.detectPatterns).toHaveBeenCalledWith('p1', 'org1');
    expect(gaps.analyzeGaps).toHaveBeenCalledWith('p1', 'org1');
    expect(contentStrategy.generateStrategy).toHaveBeenCalledWith('p1', 'org1');
    expect(actionEngine.generate).toHaveBeenCalledWith('org1', 'p1');
  });

  it('reports what each stage actually did', async () => {
    const run = await service.run('org1', 'p1');

    expect(run.stages).toEqual([
      {
        stage: 'collect_competitor_content',
        outcome: 'ran',
        detail: 'Collected 5 new competitor post(s) from 1 account(s).',
      },
      { stage: 'own_social', outcome: 'ran', detail: 'Collected 4 of your own post(s) from @you.' },
      { stage: 'classify_content', outcome: 'ran', detail: 'Classified 7 competitor post(s).' },
      { stage: 'detect_patterns', outcome: 'ran', detail: 'Detected 3 creative pattern(s) across competitors.' },
      { stage: 'analyze_gaps', outcome: 'ran', detail: 'Found 5 content gap(s).' },
      { stage: 'plan_actions', outcome: 'ran', detail: 'Action plan run r1 is running.' },
      { stage: 'content_strategy', outcome: 'ran', detail: 'Generated "Q4 Content Strategy".' },
    ]);
  });

  // "Ran and found nothing" and "did not run" lead a reader to different
  // conclusions, and the stage's own message says which it was.
  it('separates a stage with no input from one that did work, keeping its reason', async () => {
    classification.classifyPending.mockResolvedValue({
      classified: 0,
      message: 'No competitor content has been collected yet.',
    });

    const run = await service.run('org1', 'p1');

    expect(run.stages[2]).toEqual({
      stage: 'classify_content',
      outcome: 'nothing_to_do',
      detail: 'No competitor content has been collected yet.',
    });
  });

  // Later stages read stored output rather than the previous stage's return
  // value, so a failure earlier means a smaller answer, not no answer.
  it('carries on past a failed stage and records the failure', async () => {
    patterns.detectPatterns.mockRejectedValue(new Error('model unavailable'));

    const run = await service.run('org1', 'p1');

    expect(run.stages[3]).toEqual({
      stage: 'detect_patterns',
      outcome: 'failed',
      detail: 'model unavailable',
    });
    expect(gaps.analyzeGaps).toHaveBeenCalled();
    expect(contentStrategy.generateStrategy).toHaveBeenCalled();
  });

  describe('collecting competitor content', () => {
    it('reads every active account on a platform this deployment can actually read', async () => {
      await service.run('org1', 'p1');

      expect(prisma.competitorAccount.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'p1', platform: { in: ['YOUTUBE'] }, isActive: true },
        }),
      );
      expect(scraper.syncAccountContent).toHaveBeenCalledWith('org1', 'p1', 'a1');
    });

    // Exactly the state a deployment is in the moment the key is added: the
    // accounts exist, nothing has been collected, and the answer must say so
    // rather than reporting a successful empty run.
    it('says which credentials are missing rather than reporting nothing to do', async () => {
      delete process.env.YOUTUBE_API_KEY;

      const run = await service.run('org1', 'p1');

      expect(run.stages[0].outcome).toBe('nothing_to_do');
      expect(run.stages[0].detail).toContain('YOUTUBE_API_KEY');
      expect(scraper.syncAccountContent).not.toHaveBeenCalled();
    });

    it('explains an empty account list instead of blaming the credentials', async () => {
      prisma.competitorAccount.findMany.mockResolvedValue([]);

      const run = await service.run('org1', 'p1');

      expect(run.stages[0].detail).toContain('No YOUTUBE account is known');
      expect(run.stages[0].detail).toContain("competitor's own website");
    });

    // Re-running on an unchanged channel imports nothing. That is not a
    // failure, and it must not read as one.
    it('separates "nothing new" from "nothing collected"', async () => {
      scraper.syncAccountContent.mockResolvedValue({ imported: 0 });

      const run = await service.run('org1', 'p1');

      expect(run.stages[0].outcome).toBe('nothing_to_do');
      expect(run.stages[0].detail).toBe('Checked 1 competitor account(s); nothing new since the last run.');
    });

    it('names a channel it could not read and still collects the rest', async () => {
      prisma.competitorAccount.findMany.mockResolvedValue([
        { id: 'a1', handle: '@gone', platform: 'YOUTUBE', organizationId: 'org1' },
        { id: 'a2', handle: '@rival', platform: 'YOUTUBE', organizationId: 'org1' },
      ]);
      scraper.syncAccountContent
        .mockRejectedValueOnce(new Error('Channel not found'))
        .mockResolvedValueOnce({ imported: 3 });

      const run = await service.run('org1', 'p1');

      expect(run.stages[0].outcome).toBe('ran');
      expect(run.stages[0].detail).toContain('Collected 3 new competitor post(s)');
      expect(run.stages[0].detail).toContain('Could not read: @gone (Channel not found)');
    });
  });

  describe('the nightly sweep', () => {
    it('runs only for projects that actually track competitors', async () => {
      await service.runForAllProjects();

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { competitors: { some: {} } } }),
      );
      expect(classification.classifyPending).not.toHaveBeenCalled();
    });

    it('carries on past a project whose analysis throws', async () => {
      prisma.project.findMany.mockResolvedValue([
        { id: 'p1', name: 'A', organizationId: 'org1' },
        { id: 'p2', name: 'B', organizationId: 'org1' },
      ]);
      jest.spyOn(service, 'run').mockRejectedValueOnce(new Error('down'));

      await service.runForAllProjects();

      expect(service.run).toHaveBeenCalledTimes(2);
    });

    it('is disabled by the same switch as the other competitor sweeps', async () => {
      process.env.COMPETITOR_CRON_ENABLED = 'false';
      try {
        await service.runForAllProjects();
        expect(prisma.project.findMany).not.toHaveBeenCalled();
      } finally {
        delete process.env.COMPETITOR_CRON_ENABLED;
      }
    });
  });
});
