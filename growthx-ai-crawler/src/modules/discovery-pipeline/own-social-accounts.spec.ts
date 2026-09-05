import { chooseOwnProfiles, CandidateProfile } from './own-social-accounts';

const candidate = (over: Partial<CandidateProfile> & { platform: string; handle: string }): CandidateProfile => ({
  profileUrl: `https://example.com/${over.handle}`,
  pageCount: 1,
  ...over,
});

describe('chooseOwnProfiles', () => {
  it('takes the only profile a site publishes for a platform', () => {
    const { chosen, ambiguous } = chooseOwnProfiles([
      candidate({ platform: 'INSTAGRAM', handle: '@clientco', pageCount: 1 }),
    ]);

    expect(ambiguous).toEqual([]);
    expect(chosen).toEqual([expect.objectContaining({ handle: '@clientco', confidence: 95 })]);
  });

  it('keeps one account per platform and covers every platform found', () => {
    const { chosen } = chooseOwnProfiles([
      candidate({ platform: 'INSTAGRAM', handle: '@clientco', pageCount: 40 }),
      candidate({ platform: 'YOUTUBE', handle: '@clientco', pageCount: 40 }),
      candidate({ platform: 'LINKEDIN', handle: 'company/clientco', pageCount: 40 }),
    ]);

    expect(chosen.map((c) => c.platform).sort()).toEqual(['INSTAGRAM', 'LINKEDIN', 'YOUTUBE']);
  });

  // The footer is the whole signal: the business's own account is on every
  // page, the influencer they linked from one blog post is on one.
  it('prefers the profile the site links from the most pages', () => {
    const { chosen, ambiguous } = chooseOwnProfiles([
      candidate({ platform: 'INSTAGRAM', handle: '@some.influencer', pageCount: 1 }),
      candidate({ platform: 'INSTAGRAM', handle: '@clientco', pageCount: 42 }),
    ]);

    expect(ambiguous).toEqual([]);
    expect(chosen).toHaveLength(1);
    expect(chosen[0].handle).toBe('@clientco');
  });

  it('is more confident the more decisively the winner leads', () => {
    const decisive = chooseOwnProfiles([
      candidate({ platform: 'INSTAGRAM', handle: '@clientco', pageCount: 40 }),
      candidate({ platform: 'INSTAGRAM', handle: '@guest', pageCount: 1 }),
    ]).chosen[0];

    const narrow = chooseOwnProfiles([
      candidate({ platform: 'INSTAGRAM', handle: '@clientco', pageCount: 3 }),
      candidate({ platform: 'INSTAGRAM', handle: '@guest', pageCount: 2 }),
    ]).chosen[0];

    expect(decisive.confidence).toBeGreaterThan(narrow.confidence);
    expect(decisive.confidence).toBeLessThan(95);
  });

  // Storing either one would put a stranger's handle on the customer's own
  // account list, and the crawl gives no basis for choosing between them.
  it('chooses nothing when two profiles are equally linked, and says so', () => {
    const { chosen, ambiguous } = chooseOwnProfiles([
      candidate({ platform: 'INSTAGRAM', handle: '@one', pageCount: 12 }),
      candidate({ platform: 'INSTAGRAM', handle: '@two', pageCount: 12 }),
      candidate({ platform: 'YOUTUBE', handle: '@clientco', pageCount: 12 }),
    ]);

    expect(chosen.map((c) => c.platform)).toEqual(['YOUTUBE']);
    expect(ambiguous).toEqual([{ platform: 'INSTAGRAM', handles: ['@one', '@two'] }]);
  });

  it('returns nothing for a site with no social links at all', () => {
    expect(chooseOwnProfiles([])).toEqual({ chosen: [], ambiguous: [] });
  });
});
