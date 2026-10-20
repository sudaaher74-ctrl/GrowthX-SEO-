import { AiVisibilityController } from './ai-visibility.controller';

describe('competitor comparison crawl data', () => {
  const completed = { id: 'done', healthScore: 0, finishedAt: new Date('2026-10-01'), _count: { pages: 48 } };
  const row = { id: 'rival', projectId: 'project', domain: 'rival.example', lastAnalyzedAt: null, localRating: null, localReviewCount: null,
    website: { id: 'site', crawlJobs: [{ status: 'RUNNING', errorMessage: null }] } };
  const setup = (rows: any[], result: any) => {
    const prisma = { competitorDomain: { findMany: jest.fn().mockResolvedValue(rows) }, crawlJob: { findFirst: jest.fn().mockResolvedValue(result) } };
    return { prisma, controller: new AiVisibilityController({} as any, {} as any, prisma as any, {} as any) };
  };
  it('returns completed measurements while a newer recrawl runs, preserving a zero score', async () => {
    const {controller, prisma} = setup([row], completed);
    const result = await controller.listCompetitors('project');
    expect(result[0]).toMatchObject({ id: 'rival', pagesCrawled: 48, healthScore: 0, crawlStatus: 'RUNNING', lastAnalyzedAt: completed.finishedAt });
    expect(prisma.competitorDomain.findMany.mock.calls[0][0].where).toEqual({projectId:'project'});
    expect(prisma.crawlJob.findFirst.mock.calls[0][0].where).toEqual({websiteId:'site',status:'COMPLETED',finishedAt:{not:null}});
  });
  it('reports a failed recrawl while keeping completed comparison figures', async () => {
    const {controller} = setup([{...row, website:{id:'site',crawlJobs:[{status:'FAILED',errorMessage:'Blocked'}]}}], completed);
    expect((await controller.listCompetitors('project'))[0]).toMatchObject({pagesCrawled:48,crawlStatus:'FAILED',crawlError:'Blocked'});
  });
  it('leaves uncrawled competitors unmeasured', async () => {
    const {controller,prisma} = setup([{...row,website:null}], null);
    expect((await controller.listCompetitors('project'))[0]).toMatchObject({healthScore:null,crawlError:null});
    expect(prisma.crawlJob.findFirst).not.toHaveBeenCalled();
  });
});
