import { VoiceToolsService } from './voice-tools.service';

function setup(options: { running?: { id: string } | null } = {}) {
  const prisma = {
    project: { findUnique: jest.fn().mockResolvedValue({ organizationId: 'org1' }) },
    website: { findFirst: jest.fn().mockResolvedValue({ id: 'w1', domain: 'milquufresh.in' }) },
    crawlJob: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue(options.running ?? null),
      create: jest.fn(),
    },
  };
  const orgContext = { assertMembership: jest.fn().mockResolvedValue(undefined) };
  const crawler = { startCrawlJob: jest.fn().mockResolvedValue('job-1') };
  const tools = new VoiceToolsService(
    prisma as any,
    orgContext as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    crawler as any,
  );
  return { tools, prisma, crawler };
}

describe('VoiceToolsService crawl commands', () => {
  it.each(['crawlWebsite', 'runSeoAudit'] as const)(
    '%s dispatches a real crawl rather than writing an orphan row',
    async (tool) => {
      const { tools, prisma, crawler } = setup();
      const result = await tools[tool]('p1', 'u1', 'org1');

      expect(crawler.startCrawlJob).toHaveBeenCalledWith('w1', { maxDepth: 20, maxConcurrency: 10, useSitemap: true });
      expect(prisma.crawlJob.create).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ jobId: 'job-1' });
    },
  );

  it('closes out never-dispatched PENDING rows before checking for a running crawl', async () => {
    const { tools, prisma } = setup();
    await tools.crawlWebsite('p1', 'u1', 'org1');

    expect(prisma.crawlJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ websiteId: 'w1', status: 'PENDING', startedAt: null }),
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
    const cleanupOrder = prisma.crawlJob.updateMany.mock.invocationCallOrder[0];
    const lookupOrder = prisma.crawlJob.findFirst.mock.invocationCallOrder[0];
    expect(cleanupOrder).toBeLessThan(lookupOrder);
  });

  it('does not start a second crawl while one is running', async () => {
    const { tools, crawler } = setup({ running: { id: 'job-0' } });
    const result = await tools.crawlWebsite('p1', 'u1', 'org1');

    expect(crawler.startCrawlJob).not.toHaveBeenCalled();
    expect(result.spokenSummary).toContain('already in progress');
  });
});
