import { CrossCompetitorMatrixService } from './cross-competitor-matrix.service';

/** A competitor's social account as discovery registers it, one per platform. */
function account(id: string, competitorId: string, name: string, platform: string) {
  return { id, competitorId, handle: `@${name.toLowerCase().replace(/\s+/g, '')}`, displayName: name, platform, businessName: name };
}

function content(accountId: string, pillar: string, views = 1000) {
  return {
    id: `content_${accountId}_${pillar}`,
    accountId,
    platform: 'INSTAGRAM',
    contentType: 'REEL',
    title: `${pillar} post`,
    caption: '',
    viewsCount: views,
    likesCount: 10,
    commentsCount: 1,
    thumbnailUrl: null,
    publishedAt: new Date(),
    classification: { contentPillar: pillar, contentCategory: pillar, topic: 'Dairy', hookType: 'PROBLEM' },
    account: { displayName: 'x', businessName: 'x', handle: '@x' },
  };
}

describe('CrossCompetitorMatrixService', () => {
  let prisma: any;
  let service: CrossCompetitorMatrixService;

  beforeEach(() => {
    prisma = {
      competitorAccount: { findMany: jest.fn().mockResolvedValue([]) },
      competitorContent: { findMany: jest.fn().mockResolvedValue([]) },
      socialPost: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new CrossCompetitorMatrixService(prisma);
  });

  it('shows one column per company, not one per social account', async () => {
    // Three competitors on two platforms each rendered six columns reading
    // "Country Delight, Amul, BigBasket, Amul, BigBasket, Country Delight".
    prisma.competitorAccount.findMany.mockResolvedValue([
      account('a1', 'comp_cd', 'Country Delight', 'INSTAGRAM'),
      account('a2', 'comp_amul', 'Amul', 'INSTAGRAM'),
      account('a3', 'comp_bb', 'BigBasket', 'INSTAGRAM'),
      account('a4', 'comp_amul', 'Amul', 'YOUTUBE'),
      account('a5', 'comp_bb', 'BigBasket', 'YOUTUBE'),
      account('a6', 'comp_cd', 'Country Delight', 'YOUTUBE'),
    ]);
    prisma.competitorContent.findMany.mockResolvedValue([content('a1', 'EDUCATIONAL')]);

    const result = await service.getCrossCompetitorMatrix('org1', 'p1');

    expect(result.competitors).toHaveLength(3);
    expect(result.competitors.map((c: any) => c.name).sort()).toEqual(['Amul', 'BigBasket', 'Country Delight']);
    expect(result.competitors.find((c: any) => c.name === 'Amul')!.platforms.sort()).toEqual([
      'INSTAGRAM',
      'YOUTUBE',
    ]);
  });

  it('pools a company\'s content across every platform it posts on', async () => {
    prisma.competitorAccount.findMany.mockResolvedValue([
      account('a1', 'comp_cd', 'Country Delight', 'INSTAGRAM'),
      account('a2', 'comp_cd', 'Country Delight', 'YOUTUBE'),
    ]);
    prisma.competitorContent.findMany.mockResolvedValue([
      content('a1', 'EDUCATIONAL'),
      content('a2', 'EDUCATIONAL'),
    ]);

    const result = await service.getCrossCompetitorMatrix('org1', 'p1');
    const row = result.matrixRows.find((r: any) => r.topicOrPillar === 'EDUCATIONAL')!;
    const companyId = result.competitors[0].id;

    expect(row.competitorFrequency[companyId]).toBe(2);
  });

  it('reports no data rather than scoring every pillar 90/100', async () => {
    // With nothing collected, every pillar hit the "neither side covers this"
    // branch and scored MARKET_GAP / 90 — eight fabricated opportunities and a
    // grid of dashes, shown to a customer as analysis.
    prisma.competitorAccount.findMany.mockResolvedValue([
      account('a1', 'comp_cd', 'Country Delight', 'INSTAGRAM'),
    ]);
    prisma.competitorContent.findMany.mockResolvedValue([]);

    const result = await service.getCrossCompetitorMatrix('org1', 'p1');

    expect(result.matrixRows).toHaveLength(0);
    expect(result.needsData).toBe(true);
    expect(result.needsDataReason).toContain('No competitor content');
    expect(result.commonPatterns).toHaveLength(0);
  });

  it('finds content in a multi-word pillar the old matcher could never match', async () => {
    // `pillar.replace('_','')` strips only the first underscore, so
    // PROJECT_SHOWCASE was compared as PROJECTSHOWCASE and TIPS_AND_HACKS as
    // TIPSAND_HACKS — seven of the eight fixed rows could never match content
    // that was sitting right there.
    prisma.competitorAccount.findMany.mockResolvedValue([
      account('a1', 'comp_cd', 'Country Delight', 'INSTAGRAM'),
    ]);
    prisma.competitorContent.findMany.mockResolvedValue([
      content('a1', 'TIPS_AND_HACKS'),
      content('a1', 'PROJECT_SHOWCASE'),
    ]);

    const result = await service.getCrossCompetitorMatrix('org1', 'p1');
    const pillars = result.matrixRows.map((r: any) => r.topicOrPillar);
    const companyId = result.competitors[0].id;

    expect(pillars).toContain('TIPS AND HACKS');
    expect(pillars).toContain('PROJECT SHOWCASE');
    expect(result.matrixRows.every((r: any) => r.competitorFrequency[companyId] > 0)).toBe(true);
  });

  it('never invents a row for a pillar nobody publishes', async () => {
    // The fixed list emitted all eight pillars whatever the data said, and a
    // pillar neither side covered scored MARKET_GAP at 90/100 — so the rows
    // that could never match ranked as the best opportunities on the page.
    prisma.competitorAccount.findMany.mockResolvedValue([
      account('a1', 'comp_cd', 'Country Delight', 'INSTAGRAM'),
    ]);
    prisma.competitorContent.findMany.mockResolvedValue([content('a1', 'EDUCATIONAL')]);

    const result = await service.getCrossCompetitorMatrix('org1', 'p1');

    expect(result.matrixRows).toHaveLength(1);
    expect(result.matrixRows[0].topicOrPillar).toBe('EDUCATIONAL');
    expect(result.matrixRows.some((r: any) => r.gapStatus === 'MARKET_GAP')).toBe(false);
    expect(result.matrixRows.every((r: any) => r.opportunityScore < 90)).toBe(true);
  });

  it('scores a pillar every competitor runs above one only a single competitor tests', async () => {
    prisma.competitorAccount.findMany.mockResolvedValue([
      account('a1', 'comp_cd', 'Country Delight', 'INSTAGRAM'),
      account('a2', 'comp_amul', 'Amul', 'INSTAGRAM'),
    ]);
    prisma.competitorContent.findMany.mockResolvedValue([
      content('a1', 'EDUCATIONAL'),
      content('a2', 'EDUCATIONAL'),
      content('a1', 'BEHIND_SCENES'),
    ]);

    const result = await service.getCrossCompetitorMatrix('org1', 'p1');

    expect(result.matrixRows[0].topicOrPillar).toBe('EDUCATIONAL');
    expect(result.matrixRows[0].opportunityScore).toBeGreaterThan(
      result.matrixRows[1].opportunityScore,
    );
  });

  it('says so when content exists but none of it is classified yet', async () => {
    prisma.competitorAccount.findMany.mockResolvedValue([
      account('a1', 'comp_cd', 'Country Delight', 'INSTAGRAM'),
    ]);
    prisma.competitorContent.findMany.mockResolvedValue([
      { ...content('a1', 'EDUCATIONAL'), classification: null },
    ]);

    const result = await service.getCrossCompetitorMatrix('org1', 'p1');

    expect(result.matrixRows).toHaveLength(0);
    expect(result.needsData).toBe(true);
    expect(result.needsDataReason).toContain('none are classified');
  });

  it('calls a pattern a pattern only when more than one competitor runs it', async () => {
    prisma.competitorAccount.findMany.mockResolvedValue([
      account('a1', 'comp_cd', 'Country Delight', 'INSTAGRAM'),
      account('a2', 'comp_amul', 'Amul', 'INSTAGRAM'),
    ]);
    prisma.competitorContent.findMany.mockResolvedValue([
      content('a1', 'EDUCATIONAL', 5000),
      content('a2', 'EDUCATIONAL', 3000),
      // Only one competitor does this one, so it is a habit, not a pattern.
      content('a1', 'BEHIND_SCENES', 9000),
    ]);

    const result = await service.getCrossCompetitorMatrix('org1', 'p1');

    expect(result.commonPatterns).toHaveLength(1);
    expect(result.commonPatterns[0].pattern).toBe('Educational');
    expect(result.commonPatterns[0].prevalence).toBe('2 of 2 competitors');
  });
});
