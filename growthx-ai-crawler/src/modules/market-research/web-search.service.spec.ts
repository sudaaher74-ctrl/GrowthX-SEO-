import axios from 'axios';
import { WebSearchService } from './web-search.service';
import { isRecencyQuestion } from './market-research.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function config(key?: string) {
  return { get: jest.fn().mockReturnValue(key) } as any;
}

function result(url: string, title: string, content: string, score = 0.8) {
  return { url, title, content, score };
}

describe('WebSearchService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('without a key', () => {
    it('reports itself unavailable instead of failing the run', async () => {
      const service = new WebSearchService(config(undefined));

      expect(service.isConfigured()).toBe(false);
      const outcome = await service.search(['mango pulp prices']);

      expect(outcome.sources).toHaveLength(0);
      expect(outcome.unavailable).toContain('TAVILY_API_KEY');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('does not mistake a placeholder in .env.example for a real key', () => {
      expect(new WebSearchService(config('your_tavily_api_key_here')).isConfigured()).toBe(false);
      expect(new WebSearchService(config('tvly-xxxxxxxxxxxxxxxxxxxx')).isConfigured()).toBe(false);
      expect(new WebSearchService(config('short')).isConfigured()).toBe(false);
      expect(new WebSearchService(config('tvly-dev-9f3ka0sldkfj20alskdjf')).isConfigured()).toBe(true);
    });
  });

  describe('with a key', () => {
    const KEY = 'tvly-dev-9f3ka0sldkfj20alskdjf';
    let service: WebSearchService;

    beforeEach(() => {
      service = new WebSearchService(config(KEY));
    });

    it('returns a citable source per page, carrying the text that was read', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          results: [
            result('https://apeda.gov.in/report', 'APEDA export statistics', 'Mango pulp exports rose 14%.'),
          ],
        },
      });

      const outcome = await service.search(['indian mango pulp export volumes 2026']);

      expect(outcome.sources).toHaveLength(1);
      expect(outcome.sources[0]).toMatchObject({
        type: 'PUBLIC_WEB',
        url: 'https://apeda.gov.in/report',
        title: 'APEDA export statistics',
        publisher: 'apeda.gov.in',
        excerpt: 'Mango pulp exports rose 14%.',
      });
      expect(outcome.unavailable).toBeUndefined();
    });

    it('sends the key as a bearer token, not in the body', async () => {
      mockedAxios.post.mockResolvedValue({ data: { results: [result('https://a.com', 'A', 'text')] } });

      await service.search(['q']);

      const [, body, cfg] = mockedAxios.post.mock.calls[0];
      expect((cfg as any).headers.Authorization).toBe(`Bearer ${KEY}`);
      expect(JSON.stringify(body)).not.toContain(KEY);
    });

    // A page with no text cannot be quoted, so it must not become a citation.
    it('drops a result that came back with no readable content', async () => {
      mockedAxios.post.mockResolvedValue({
        data: { results: [result('https://a.com', 'A', ''), result('https://b.com', 'B', 'real text')] },
      });

      const outcome = await service.search(['q']);

      expect(outcome.sources.map((s) => s.url)).toEqual(['https://b.com']);
    });

    it('returns one source when the same page answers two different queries', async () => {
      mockedAxios.post
        .mockResolvedValueOnce({ data: { results: [result('https://a.com/p', 'A', 'first read', 0.5)] } })
        .mockResolvedValueOnce({ data: { results: [result('https://a.com/p', 'A', 'better read', 0.9)] } });

      const outcome = await service.search(['q1', 'q2']);

      expect(outcome.sources).toHaveLength(1);
      // The provider's higher-scored copy wins, not whichever arrived first.
      expect(outcome.sources[0].excerpt).toBe('better read');
    });

    it('ranks by the provider score', async () => {
      mockedAxios.post.mockResolvedValue({
        data: {
          results: [
            result('https://low.com', 'Low', 'text', 0.2),
            result('https://high.com', 'High', 'text', 0.95),
          ],
        },
      });

      const outcome = await service.search(['q']);

      expect(outcome.sources.map((s) => s.url)).toEqual(['https://high.com', 'https://low.com']);
    });

    // Partial market evidence beats none; the shortfall becomes an evidence gap.
    it('keeps the results of the queries that worked when one query fails', async () => {
      mockedAxios.post
        .mockRejectedValueOnce(new Error('429 rate limited'))
        .mockResolvedValueOnce({ data: { results: [result('https://b.com', 'B', 'text')] } });

      const outcome = await service.search(['q1', 'q2']);

      expect(outcome.sources).toHaveLength(1);
      expect(outcome.unavailable).toContain('1 of 2 web searches failed');
    });

    it('says the provider could not be reached when every query fails', async () => {
      mockedAxios.post.mockRejectedValue(new Error('ECONNREFUSED'));

      const outcome = await service.search(['q1', 'q2']);

      expect(outcome.sources).toHaveLength(0);
      expect(outcome.unavailable).toContain('could not be reached');
    });

    it('asks the news index with a recency window for a "what changed" question', async () => {
      mockedAxios.post.mockResolvedValue({ data: { results: [result('https://a.com', 'A', 'text')] } });

      await service.search(['fruit pulp market'], { recentOnly: true });

      const [, body] = mockedAxios.post.mock.calls[0];
      expect(body).toMatchObject({ topic: 'news', days: 30 });
    });

    it('uses the general index for a question that is not about change', async () => {
      mockedAxios.post.mockResolvedValue({ data: { results: [result('https://a.com', 'A', 'text')] } });

      await service.search(['what is aseptic processing'], { recentOnly: false });

      const [, body] = mockedAxios.post.mock.calls[0];
      expect(body).not.toHaveProperty('topic');
    });
  });
});

describe('isRecencyQuestion', () => {
  // The question that exposed the gap: asked of a general index it returns the
  // same evergreen category pages every time.
  it('routes "what changed this week" to the news index', () => {
    expect(isRecencyQuestion('What changed for Premium Fruit Pulp Exporter India buyers this week?')).toBe(true);
  });

  it.each([
    'What are the latest mango pulp prices?',
    'Any recent news on APEDA export rules?',
    'What is trending in agro exports?',
    'Which competitors launched a new product?',
    'Has anything changed in the last quarter?',
  ])('treats %j as a recency question', (question) => {
    expect(isRecencyQuestion(question)).toBe(true);
  });

  it.each([
    'How is our positioning different from our top competitors?',
    'What content should we create to close the biggest visibility gap?',
    'What is aseptic fruit pulp processing?',
  ])('treats %j as an evergreen question', (question) => {
    expect(isRecencyQuestion(question)).toBe(false);
  });
});
