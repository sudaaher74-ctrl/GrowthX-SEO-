import { AutomationService } from './automation.service';
jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }));

describe('Fix Engine change evidence', () => {
  const before = new Date('2026-01-01T00:00:00Z');
  const finished = new Date('2026-01-02T00:00:00Z');
  const after = new Date('2026-01-03T00:00:00Z');
  const change = { issueId: 'issue', url: 'https://client.test/contact', field: 'META_TITLE', before: 'Home', after: 'Contact', why: 'Each page needs its own title', file: 'contact.jsx', measuredAt: before.toISOString() };
  function setup(pages: any[], steps: any[] = [{ step: 'change', change }]) {
    const prisma = { automationRun: { findMany: jest.fn().mockResolvedValue([{ id: 'run', status: 'AWAITING_REVIEW', steps, filesChanged: ['contact.jsx', 'contact.jsx'], startedAt: before, finishedAt: finished }]) }, page: { findMany: jest.fn().mockResolvedValue(pages) } };
    const service = new AutomationService(prisma as any, null!, null!, null!, null!, null!, null!, null!);
    return { service, prisma };
  }
  const page = (title: string, date = after, extra = {}) => ({ url: change.url, title, statusCode: 200, blockedSuspected: false, crawlJob: { createdAt: date }, ...extra });

  it('confirms a matching value only in a later measured page', async () => {
    const { service, prisma } = setup([page('Contact')]);
    const [report] = await service.listChanges('customer');
    expect(report.changes[0]).toMatchObject({ verification: 'MATCHED', liveValue: 'Contact', before: 'Home' });
    expect(report.filesChanged).toEqual(['contact.jsx']);
    expect(prisma.page.findMany.mock.calls[0][0].where.crawlJob.website).toEqual({ projectId: 'customer', scope: 'own' });
  });
  it('shows a different live value without claiming the fix worked', async () => {
    const { service } = setup([page('Different')]);
    expect((await service.listChanges('customer'))[0].changes[0].verification).toBe('DIFFERENT');
  });
  it.each([page('Contact', before), page('Contact', after, { statusCode: 403 }), page('Contact', after, { blockedSuspected: true })])('does not verify old or blocked measurements', async measured => {
    const { service } = setup([measured]);
    expect((await service.listChanges('customer'))[0].changes[0]).toMatchObject({ verification: 'NOT_CHECKED', liveValue: null, checkedAt: null });
  });
  it('does not manufacture before/after values for old runs', async () => {
    const { service, prisma } = setup([], [{ step: 'patch', detail: '9 files' }]);
    expect((await service.listChanges('customer'))[0].changes).toEqual([]);
    expect(prisma.page.findMany).not.toHaveBeenCalled();
  });
});
