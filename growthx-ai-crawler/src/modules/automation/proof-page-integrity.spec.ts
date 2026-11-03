jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }));
jest.mock('simple-git', () => ({ simpleGit: jest.fn() }));
import { ProofOfImpactService } from './proof-of-impact.service';

it('never assigns a verified refund-page snapshot to the first local-page change in a batch', async () => {
  const prisma = {
    project: { findUnique: jest.fn().mockResolvedValue({ name: 'Example', websites: [{ domain: 'example.com' }] }) },
    automationRun: { findMany: jest.fn().mockResolvedValue([{ id: 'run', status: 'MERGED', filesChanged: ['local.tsx', 'refund.tsx'], steps: [
      { change: { url: 'https://example.com/local', field: 'META_TITLE', file: 'local.tsx' } },
      { change: { url: 'https://example.com/refund', field: 'META_TITLE', file: 'refund.tsx' } },
    ] }]) },
    fixSnapshot: { findMany: jest.fn().mockResolvedValue([
      { automationRunId: 'run', url: 'https://example.com/local', snapshotType: 'BEFORE', title: 'Wrong baseline' },
      { automationRunId: 'run', url: 'https://example.com/refund', snapshotType: 'VERIFIED_LIVE', pageId: 'refund', title: 'Refund policy', contentSnippet: 'META_TITLE: Refund policy', capturedAt: new Date() },
    ]) },
    growthOpportunity: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const service = new ProofOfImpactService(prisma as any, {} as any, {} as any);
  jest.spyOn(service as any, 'initializeDay1TrackingEvents').mockResolvedValue(undefined);
  const gsc = jest.spyOn(service as any, 'getFixGscImpact').mockResolvedValue({ windows: [] });
  jest.spyOn(service as any, 'getFixAiImpact').mockResolvedValue({ models: [] });
  const [card] = await service.get30d90dProof('project');
  expect(card.url).toBe('https://example.com/refund');
  expect(card.file).toBe('refund.tsx');
  expect(card.before.text).toBeNull();
  expect(card.after.text).toBe('Refund policy');
  expect(gsc).toHaveBeenCalledWith('project', 'https://example.com/refund', expect.any(Date));
});
