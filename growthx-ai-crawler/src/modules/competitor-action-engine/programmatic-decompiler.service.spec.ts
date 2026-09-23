import { ProgrammaticDecompilerService } from './programmatic-decompiler.service';

/**
 * Nothing in the crawl measures a competitor's traffic, so no cluster carries
 * a visit figure (this used to be page count × 520). Example values come from
 * the competitor's own URLs, not from a stock list of SEO tools.
 */
describe('ProgrammaticDecompilerService', () => {
  function build(urls: string[]) {
    const prisma: any = {
      website: { findFirst: jest.fn().mockResolvedValue({ id: 'w1', domain: 'client.com' }) },
      competitorDomain: {
        findMany: jest.fn().mockResolvedValue([{ id: 'c1', domain: 'rival.com', websiteId: 'w2' }]),
      },
      page: { findMany: jest.fn().mockResolvedValue(urls.map((url) => ({ url, title: null, h1: null }))) },
    };
    return new ProgrammaticDecompilerService(prisma);
  }

  it('reports what was crawled and nothing that was not', async () => {
    const { scoreboard, clusters } = await build([
      'https://rival.com/integrations/tally',
      'https://rival.com/integrations/zoho-books',
    ]).getProgrammaticMatrix('p1');

    expect(clusters).toHaveLength(1);
    expect(clusters[0].pageCount).toBe(2);
    expect(clusters[0]).not.toHaveProperty('estimatedMonthlyVisits');
    expect(scoreboard).not.toHaveProperty('estimatedTotalTrafficCaptured');
    expect(clusters[0].variables[0].exampleValues).toEqual(['tally', 'zoho-books']);
  });

  it('hands the customer a scaffold to fill rather than claims about either business', async () => {
    const { clusters } = await build([
      'https://rival.com/vs/acme',
      'https://rival.com/vs/globex',
    ]).getProgrammaticMatrix('p1');

    const template = clusters[0].counterStrategy.sampleDeliverableTemplate;
    expect(template).toContain('[Your answer]');
    expect(template).not.toMatch(/Live AST|Manual CSV|Perplexity/);
    expect(clusters[0].counterStrategy.targetH1Formula).toContain(String(new Date().getFullYear()));
  });
});
