import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { AiVisibilityService } from '../ai-visibility/ai-visibility.service';
import { EvidenceRetrievalService, cosine, tokenize } from './evidence-retrieval.service';
import { ModelRouterService } from './model-router.service';

function page(url: string, title: string, h2: string[] = [], metaDescription = '') {
  return { url, title, metaDescription, h1: [title], h2 };
}

describe('EvidenceRetrievalService — lexical retrieval', () => {
  let service: EvidenceRetrievalService;
  let prisma: any;
  let models: any;

  beforeEach(async () => {
    prisma = {
      website: { findMany: jest.fn().mockResolvedValue([{ id: 'w1' }]) },
      page: { findMany: jest.fn() },
      researchEmbedding: { findMany: jest.fn().mockResolvedValue([]) },
    };
    // No embedding model: this is the live path on Groq and OpenRouter.
    models = { supportsEmbeddings: jest.fn().mockReturnValue(false), embed: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceRetrievalService,
        { provide: PrismaService, useValue: prisma },
        { provide: ModelRouterService, useValue: models },
        { provide: AiVisibilityService, useValue: { getReport: jest.fn() } },
      ],
    }).compile();

    service = module.get(EvidenceRetrievalService);
  });

  it('ranks the page whose title matches the query first', async () => {
    prisma.page.findMany.mockResolvedValue([
      page('https://x.com/about', 'About our company'),
      page('https://x.com/pricing', 'Pricing and plans'),
      page('https://x.com/blog', 'Blog'),
    ]);

    const results = await service.searchClientPages('org', 'proj', 'pricing plans');

    expect(results[0].url).toBe('https://x.com/pricing');
    expect(models.embed).not.toHaveBeenCalled();
  });

  // BM25's length normalisation: a long page must not win purely on volume.
  it('does not let a long page outrank a focused one', async () => {
    prisma.page.findMany.mockResolvedValue([
      page('https://x.com/focused', 'Winter jackets'),
      page(
        'https://x.com/everything',
        'Everything store',
        ['winter jackets', 'boots', 'tents', 'kayaks', 'socks', 'hats', 'gloves', 'skis'],
        'We sell boots tents kayaks socks hats gloves skis and much more besides',
      ),
    ]);

    const results = await service.searchClientPages('org', 'proj', 'winter jackets');

    expect(results[0].url).toBe('https://x.com/focused');
  });

  // Term saturation: repeating a word many times should not dominate.
  it('saturates repeated terms rather than rewarding keyword stuffing', async () => {
    prisma.page.findMany.mockResolvedValue([
      page('https://x.com/stuffed', 'jackets jackets jackets jackets jackets jackets'),
      page('https://x.com/real', 'Winter jackets buying guide', ['jackets for cold weather']),
    ]);

    const results = await service.searchClientPages('org', 'proj', 'winter jackets guide');

    expect(results[0].url).toBe('https://x.com/real');
  });

  it('ignores a term that appears on every page', async () => {
    prisma.page.findMany.mockResolvedValue([
      page('https://x.com/a', 'Acme pricing'),
      page('https://x.com/b', 'Acme about'),
      page('https://x.com/c', 'Acme careers'),
    ]);

    // "acme" is on every page and carries no signal; "careers" decides it.
    const results = await service.searchClientPages('org', 'proj', 'acme careers');

    expect(results[0].url).toBe('https://x.com/c');
  });

  it('returns nothing when no page matches, rather than a weak guess', async () => {
    prisma.page.findMany.mockResolvedValue([page('https://x.com/a', 'Winter jackets')]);

    const results = await service.searchClientPages('org', 'proj', 'quantum computing');

    expect(results).toEqual([]);
  });

  it('returns nothing when the project has never been crawled', async () => {
    prisma.page.findMany.mockResolvedValue([]);

    const results = await service.searchClientPages('org', 'proj', 'anything');

    expect(results).toEqual([]);
  });

  it('scores the best match at 1 so the drawer reads on a 0-1 scale', async () => {
    prisma.page.findMany.mockResolvedValue([
      page('https://x.com/pricing', 'Pricing'),
      page('https://x.com/other', 'Pricing and something else entirely'),
    ]);

    const results = await service.searchClientPages('org', 'proj', 'pricing');

    expect(results[0].qualityScore).toBeCloseTo(1, 5);
    for (const r of results) {
      expect(r.qualityScore).toBeGreaterThanOrEqual(0);
      expect(r.qualityScore).toBeLessThanOrEqual(1);
    }
  });
});

describe('tokenize', () => {
  it('deduplicates for a query but keeps counts for a document', () => {
    expect(tokenize('jackets jackets winter')).toEqual(['jackets', 'winter']);
    expect(tokenize('jackets jackets winter', false)).toEqual(['jackets', 'jackets', 'winter']);
  });

  it('drops punctuation and very short words', () => {
    expect(tokenize('SEO: the best-ever guide!')).toEqual(['seo', 'the', 'best', 'ever', 'guide']);
  });
});

describe('cosine', () => {
  it('is 1 for identical vectors and 0 for orthogonal ones', () => {
    expect(cosine([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosine([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('is NaN for mismatched or empty vectors rather than a misleading number', () => {
    expect(Number.isNaN(cosine([1, 0], [1, 0, 0]))).toBe(true);
    expect(Number.isNaN(cosine([], []))).toBe(true);
    expect(Number.isNaN(cosine([0, 0], [1, 1]))).toBe(true);
  });
});
