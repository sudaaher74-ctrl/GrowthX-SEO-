import { AutomationService } from './automation.service';
jest.mock('@octokit/rest', () => ({ Octokit: jest.fn() }));

describe('Fix Engine change evidence', () => {
  const before = new Date('2026-01-01T00:00:00Z');
  const finished = new Date('2026-01-02T00:00:00Z');
  const after = new Date('2026-01-03T00:00:00Z');
  const change = { issueId: 'issue', url: 'https://client.test/contact', field: 'META_TITLE', before: 'Home', after: 'Contact', why: 'Each page needs its own title', file: 'contact.jsx', measuredAt: before.toISOString() };
  function setup(pages: any[], steps: any[] = [{ step: 'change', change }]) {
    const prisma = { siteRepository: { findUnique: jest.fn().mockResolvedValue(null) }, automationRun: { findMany: jest.fn().mockResolvedValue([{ id: 'run', status: 'AWAITING_REVIEW', steps, filesChanged: ['contact.jsx', 'contact.jsx'], startedAt: before, finishedAt: finished }]) }, page: { findMany: jest.fn().mockResolvedValue(pages) } };
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
  it('recovers a legacy merged title using saved routes and audit values', async () => {
    const { service, prisma } = setup([page('Contact'), page('Home', new Date('2025-12-31T00:00:00Z'))], []);
    const run = (await prisma.automationRun.findMany())[0];
    run.pullRequestUrl = 'https://github.com/customer/website/pull/10';
    prisma.siteRepository.findUnique.mockResolvedValue({ id: 'repo', owner: 'customer', name: 'website', accessTokenEncrypted: 'encrypted' } as never);
    const read = jest.fn().mockResolvedValue({ state: 'MERGED', mergedAt: finished.toISOString(), baseSha: 'base', headSha: 'head',
      files: [{ file: 'frontend/src/pages/Contact.jsx', before: 'export default function Contact(){return <p>Contact</p>}', after: 'export default function Contact(){return <title>{"Contact"}</title>}' }],
      routers: [{ file: 'frontend/src/router.jsx', content: 'const Contact=lazy(()=>import("./pages/Contact"));const router=createBrowserRouter([{path:"/",children:[{path:"contact",element:<Contact/>}]}]);' }],
    });
    Object.assign(service, { git: { readPullRequestEvidence: read }, security: { decryptCredentials: () => 'test-token' } });
    const [report] = await service.listChanges('customer');
    expect(report.reviewState).toBe('MERGED');
    expect(report.changes[0]).toMatchObject({ url: change.url, before: 'Home', after: 'Contact', source: 'Pull request revision head', verification: 'MATCHED' });
  });
  it('never sends the repository token to a different pull request owner', async () => {
    const { service, prisma } = setup([], []);
    const run = (await prisma.automationRun.findMany())[0];
    run.pullRequestUrl = 'https://github.com/other/website/pull/10';
    prisma.siteRepository.findUnique.mockResolvedValue({ id: 'repo', owner: 'customer', name: 'website' } as never);
    const read = jest.fn();
    Object.assign(service, { git: { readPullRequestEvidence: read } });
    expect((await service.listChanges('customer'))[0].reviewState).toBe('UNKNOWN');
    expect(read).not.toHaveBeenCalled();
  });
});
