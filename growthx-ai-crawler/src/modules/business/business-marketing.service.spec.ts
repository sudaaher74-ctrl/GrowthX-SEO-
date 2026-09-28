import { ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { BusinessMarketingService, pageCopy } from './business-marketing.service';

/**
 * The AI call here reads a page nobody vetted before it runs. Three failure
 * modes matter more than the happy path: a model that answers with garbage
 * must fail with a message the customer can read rather than silently, a
 * failed read must not wipe out the last good one, and regenerating must not
 * leave last week's value prop sitting next to this week's.
 */
describe('BusinessMarketingService', () => {
  const homePage = {
    id: 'page1',
    title: 'Acme Fruit Exports — Bulk IQF Fruit Supplier',
    metaDescription: 'Aseptic fruit pulp and IQF fruit, exported worldwide since 1998.',
    h1: ['Bulk Fruit Pulp & IQF Fruit, Exported Worldwide'],
    rawHtml: '<html><body><h1>Bulk Fruit Pulp & IQF Fruit</h1><p>20% off your first bulk order this month.</p></body></html>',
  };

  const build = (aiResponse: { text: string } | Error) => {
    const prisma = {
      page: {
        findFirst: jest.fn().mockResolvedValue(homePage),
      },
      competitorDomain: {
        findFirst: jest.fn().mockResolvedValue({ id: 'comp1', projectId: 'p1', websiteId: 'w1' }),
      },
      marketingSignal: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const aiRouter = {
      generate: aiResponse instanceof Error ? jest.fn().mockRejectedValue(aiResponse) : jest.fn().mockResolvedValue(aiResponse),
    };
    return { prisma, aiRouter, service: new BusinessMarketingService(prisma as any, aiRouter as any) };
  };

  it('persists the value props, promos and tone the model actually returned', async () => {
    const { prisma, service } = build({
      text: JSON.stringify({
        valueProps: ['Bulk fruit pulp exported worldwide since 1998'],
        promos: ['20% off your first bulk order this month'],
        tone: 'plain B2B/technical',
      }),
    });

    await service.generateForOwnSite('org1', 'p1');

    expect(prisma.marketingSignal.createMany).toHaveBeenCalledTimes(1);
    const rows = prisma.marketingSignal.createMany.mock.calls[0][0].data;
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'VALUE_PROP', text: 'Bulk fruit pulp exported worldwide since 1998', competitorId: null }),
        expect.objectContaining({ kind: 'PROMO', text: '20% off your first bulk order this month' }),
        expect.objectContaining({ kind: 'TONE', text: 'plain B2B/technical' }),
      ]),
    );
  });

  it('clears the previous read before writing the new one, so regenerating replaces rather than appends', async () => {
    const { prisma, service } = build({ text: JSON.stringify({ valueProps: ['x'], promos: [], tone: null }) });

    await service.generateForOwnSite('org1', 'p1');

    expect(prisma.marketingSignal.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'p1', competitorId: null } });
    const deleteOrder = prisma.marketingSignal.deleteMany.mock.invocationCallOrder[0];
    const createOrder = prisma.marketingSignal.createMany.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(createOrder);
  });

  it('reads JSON the model wrapped in a code fence', async () => {
    const { prisma, service } = build({
      text: '```json\n' + JSON.stringify({ valueProps: ['Farm-fresh milk delivered daily'], promos: [], tone: 'warm' }) + '\n```',
    });

    await service.generateForOwnSite('org1', 'p1');

    const rows = prisma.marketingSignal.createMany.mock.calls[0][0].data;
    expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'VALUE_PROP', text: 'Farm-fresh milk delivered daily' })]));
  });

  it('asks the router for a schema, so it enforces JSON and moves on from a provider that answers in prose', async () => {
    const { aiRouter, service } = build({ text: JSON.stringify({ valueProps: [], promos: [], tone: 'warm' }) });

    await service.generateForOwnSite('org1', 'p1');

    expect(aiRouter.generate.mock.calls[0][0].jsonSchema).toEqual(
      expect.objectContaining({ required: ['valueProps', 'promos', 'tone'] }),
    );
  });

  it('fails with a readable message, and keeps the previous read, when the model answers with something that is not JSON', async () => {
    const { prisma, service } = build({ text: 'Sure! Here is the analysis you asked for: ...' });

    await expect(service.generateForOwnSite('org1', 'p1')).rejects.toThrow(ServiceUnavailableException);
    await expect(service.generateForOwnSite('org1', 'p1')).rejects.toThrow(/previous results are unchanged/);
    expect(prisma.marketingSignal.deleteMany).not.toHaveBeenCalled();
    expect(prisma.marketingSignal.createMany).not.toHaveBeenCalled();
  });

  it('fails with a readable message, and keeps the previous read, when the AI router call itself fails', async () => {
    const { prisma, service } = build(new Error('All available AI providers failed. Last error: HTTP 429'));

    await expect(service.generateForOwnSite('org1', 'p1')).rejects.toThrow(ServiceUnavailableException);
    await expect(service.generateForOwnSite('org1', 'p1')).rejects.not.toThrow(/HTTP 429/);
    expect(prisma.marketingSignal.deleteMany).not.toHaveBeenCalled();
  });

  it('treats a declined answer as a failure, not as "the page says nothing"', async () => {
    const { prisma, service } = build({ text: '', refused: true, provider: 'GROQ' } as any);

    await expect(service.generateForOwnSite('org1', 'p1')).rejects.toThrow(ServiceUnavailableException);
    expect(prisma.marketingSignal.deleteMany).not.toHaveBeenCalled();
  });

  it('refuses a page with no readable text before calling the model, and keeps the previous read', async () => {
    const { prisma, aiRouter, service } = build({ text: '{}' });
    prisma.page.findFirst.mockResolvedValue({
      id: 'page1',
      title: null,
      metaDescription: null,
      h1: [],
      rawHtml: '<html><body><script>window.__DATA__ = {}</script></body></html>',
      renderedHtml: null,
    });

    await expect(service.generateForOwnSite('org1', 'p1')).rejects.toThrow(UnprocessableEntityException);
    expect(aiRouter.generate).not.toHaveBeenCalled();
    expect(prisma.marketingSignal.deleteMany).not.toHaveBeenCalled();
  });

  it('refuses to generate for a competitor that has never been crawled', async () => {
    const { prisma, service } = build({ text: '{}' });
    prisma.competitorDomain.findFirst.mockResolvedValue({ id: 'comp1', projectId: 'p1', websiteId: null });

    await expect(service.generateForCompetitor('org1', 'p1', 'comp1')).rejects.toThrow(/not been crawled/);
  });

  it('refuses to generate for a competitor that does not belong to this project', async () => {
    const { prisma, service } = build({ text: '{}' });
    prisma.competitorDomain.findFirst.mockResolvedValue(null);

    await expect(service.generateForCompetitor('org1', 'p1', 'comp1')).rejects.toThrow(/not found/);
  });

  it('falls back to the most content-rich page when nothing was classified as the homepage', async () => {
    const { prisma, service } = build({ text: JSON.stringify({ valueProps: [], promos: [], tone: 'casual' }) });
    prisma.page.findFirst
      .mockResolvedValueOnce(null) // no HOME page
      .mockResolvedValueOnce(homePage); // falls back to highest word count

    await service.generateForOwnSite('org1', 'p1');

    expect(prisma.page.findFirst).toHaveBeenCalledTimes(2);
    expect(prisma.page.findFirst.mock.calls[1][0]).toEqual(expect.objectContaining({ orderBy: { wordCount: 'desc' } }));
  });

  it('refuses when the project has no crawled page at all, rather than calling the model on nothing', async () => {
    const { prisma, aiRouter, service } = build({ text: '{}' });
    prisma.page.findFirst.mockResolvedValue(null);

    await expect(service.generateForOwnSite('org1', 'p1')).rejects.toThrow(/run a Website Audit/);
    expect(aiRouter.generate).not.toHaveBeenCalled();
  });

  describe('pageCopy', () => {
    const base = { title: 'Milk Co', metaDescription: null, h1: ['Fresh milk'], rawHtml: null, renderedHtml: null };

    it('sends the words on the page, not the contents of its scripts and styles', () => {
      const copy = pageCopy({
        ...base,
        rawHtml:
          '<html><body><script>var cart = {"items":[]}; function track(){}</script><style>.a{color:red}</style>' +
          '<p>Delivered before 7am, every day.</p><noscript>Enable JavaScript</noscript><svg><text>logo</text></svg></body></html>',
      });

      expect(copy).toContain('Delivered before 7am, every day.');
      expect(copy).not.toMatch(/cart|track|color:red|Enable JavaScript|logo/);
    });

    it('prefers the rendered page, where a site built in the browser keeps its copy', () => {
      const copy = pageCopy({
        ...base,
        rawHtml: '<html><body><div id="root"></div></body></html>',
        renderedHtml: '<html><body><div id="root"><p>Free delivery on your first order</p></div></body></html>',
      });

      expect(copy).toContain('Free delivery on your first order');
    });
  });
});
