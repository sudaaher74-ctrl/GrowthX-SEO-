import axios from 'axios';
import { DataForSeoError, DataForSeoService, parseGoogleResults, parseRankedKeywords } from './dataforseo.service';

jest.mock('axios');
const post = axios.post as jest.MockedFunction<typeof axios.post>;

function service(env: Record<string, string | undefined> = { DATAFORSEO_LOGIN: 'api@example.com', DATAFORSEO_PASSWORD: 'secret' }) {
  return new DataForSeoService({ get: (k: string) => env[k] } as any);
}

const ok = (result: unknown, cost = 0.002) => ({ status: 200, data: { status_code: 20000, tasks: [{ status_code: 20000, cost, result: [result] }] } });

describe('DataForSeoService', () => {
  beforeEach(() => post.mockReset());

  it('is not configured without both the login and the password', () => {
    expect(service({ DATAFORSEO_LOGIN: 'x' }).isConfigured()).toBe(false);
    expect(service().isConfigured()).toBe(true);
  });

  it('says how to connect it, and asks nothing, when not configured', async () => {
    await expect(service({}).googleResults('milk', { country: 'India', language: 'en' })).rejects.toThrow(/DATAFORSEO_LOGIN/);
    expect(post).not.toHaveBeenCalled();
  });

  it('asks for the live Google results in the project market', async () => {
    post.mockResolvedValue(ok({ items: [] }));
    await service().googleResults('a2 milk pune', { country: 'India', language: 'en' });
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('https://api.dataforseo.com/v3/serp/google/organic/live/advanced');
    expect(body).toEqual([{ keyword: 'a2 milk pune', location_name: 'India', language_code: 'en', device: 'desktop', depth: 20 }]);
    expect((config as any).auth).toEqual({ username: 'api@example.com', password: 'secret' });
  });

  it('reports a failed task even when the request itself succeeded', async () => {
    post.mockResolvedValue({ status: 200, data: { status_code: 20000, tasks: [{ status_code: 40501, status_message: 'Invalid Field: location_name.' }] } });
    await expect(service().googleResults('milk', { country: 'Narnia', language: 'en' })).rejects.toThrow('Invalid Field: location_name.');
  });

  it('turns a refused login and an empty balance into plain messages', async () => {
    post.mockResolvedValue({ status: 401, data: {} });
    await expect(service().googleResults('milk', { country: 'India', language: 'en' })).rejects.toThrow(/refused the login/);
    post.mockResolvedValue({ status: 402, data: {} });
    const error = await service().googleResults('milk', { country: 'India', language: 'en' }).catch((e) => e);
    expect(error).toBeInstanceOf(DataForSeoError);
    expect(error.code).toBe(402);
  });

  it('asks for the keywords a domain ranks for, most searched first, within the top positions', async () => {
    post.mockResolvedValue(ok({ total_count: 0, items: [] }));
    await service().rankedKeywords('https://www.countrydelight.in/', { country: 'India', language: 'en', limit: 300, maxPosition: 20 });
    const [url, body] = post.mock.calls[0];
    expect(url).toBe('https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live');
    expect((body as any)[0]).toMatchObject({
      target: 'countrydelight.in',
      limit: 300,
      order_by: ['keyword_data.keyword_info.search_volume,desc'],
      filters: [['ranked_serp_element.serp_item.rank_group', '<=', 20]],
    });
  });
});

describe('parseGoogleResults', () => {
  it('keeps organic results in order and lists every other result type once', () => {
    const parsed = parseGoogleResults(
      {
        item_types: ['local_pack', 'organic', 'people_also_ask', 'images'],
        se_results_count: 1200000,
        items: [
          { type: 'local_pack', rank_group: 1 },
          { type: 'organic', rank_group: 2, url: 'https://www.b.com/x', domain: 'www.b.com', title: 'B' },
          { type: 'organic', rank_group: 1, url: 'https://a.com/', domain: 'a.com', title: 'A', description: 'about a' },
          { type: 'people_also_ask', items: [{ title: 'Is A2 milk better?' }, { title: 'What is A2 milk?' }] },
          { type: 'organic', rank_group: 3 },
        ],
      },
      { keyword: 'a2 milk', country: 'India', language: 'en', device: 'desktop', costUsd: 0.002 },
    );
    expect(parsed.organic.map((r) => [r.position, r.domain])).toEqual([
      [1, 'a.com'],
      [2, 'b.com'],
    ]);
    expect(parsed.features.sort()).toEqual(['images', 'local_pack', 'people_also_ask']);
    expect(parsed.questions).toEqual(['Is A2 milk better?', 'What is A2 milk?']);
    expect(parsed.totalResults).toBe(1200000);
  });

  it('copes with an empty or missing result', () => {
    expect(parseGoogleResults(null, { keyword: 'x', country: 'India', language: 'en', device: 'desktop', costUsd: null }).organic).toEqual([]);
  });
});

describe('parseRankedKeywords', () => {
  it('reads keyword, volume, position and URL, skipping rows without a position', () => {
    const parsed = parseRankedKeywords(
      {
        total_count: 812,
        items: [
          {
            keyword_data: { keyword: 'milk delivery', keyword_info: { search_volume: 9900 }, search_intent_info: { main_intent: 'transactional' } },
            ranked_serp_element: { serp_item: { rank_group: 3, url: 'https://cd.in/milk' } },
          },
          { keyword_data: { keyword: 'broken' }, ranked_serp_element: {} },
        ],
      },
      'cd.in',
      0.05,
    );
    expect(parsed).toEqual({
      domain: 'cd.in',
      totalCount: 812,
      costUsd: 0.05,
      items: [{ keyword: 'milk delivery', searchVolume: 9900, position: 3, url: 'https://cd.in/milk', intent: 'transactional' }],
    });
  });
});
