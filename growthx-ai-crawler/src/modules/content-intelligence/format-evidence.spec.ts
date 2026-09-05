import { buildFormatEvidence, describeFormats, FormatPost } from './format-evidence';

const day = (n: number) => new Date(Date.UTC(2026, 7, n));

const post = (over: Partial<FormatPost> = {}): FormatPost => ({
  platform: 'INSTAGRAM',
  contentType: 'REEL',
  views: 1000,
  likes: 100,
  comments: 10,
  publishedAt: day(1),
  headline: 'A reel',
  ...over,
});

describe('buildFormatEvidence', () => {
  it('groups by platform and format together, since neither alone decides anything', () => {
    const { competitors } = buildFormatEvidence(
      [
        post({ contentType: 'REEL' }),
        post({ contentType: 'IMAGE' }),
        post({ platform: 'YOUTUBE', contentType: 'SHORT' }),
      ],
      [],
    );

    expect(competitors.map((entry) => entry.format).sort()).toEqual([
      'INSTAGRAM_IMAGE',
      'INSTAGRAM_REEL',
      'YOUTUBE_SHORT',
    ]);
  });

  // Social performance is long-tailed: one unusual hit pulls a mean far above
  // anything the account typically achieves.
  it('reports the median, not the mean, so one viral post does not set the target', () => {
    const { competitors } = buildFormatEvidence(
      [
        post({ views: 100, publishedAt: day(1) }),
        post({ views: 200, publishedAt: day(8) }),
        post({ views: 300, publishedAt: day(15) }),
        post({ views: 400, publishedAt: day(22) }),
        post({ views: 900000, publishedAt: day(29) }),
      ],
      [],
    );

    expect(competitors[0].medianViews).toBe(300);
  });

  // A platform that reports no views has not reported zero views.
  it('drops unreported figures rather than averaging zeros into them', () => {
    const { competitors } = buildFormatEvidence(
      [
        post({ views: null, likes: 50 }),
        post({ views: null, likes: 100 }),
        post({ views: null, likes: 150 }),
      ],
      [],
    );

    expect(competitors[0].medianViews).toBeNull();
    expect(competitors[0].medianLikes).toBe(100);
  });

  it('refuses to call one or two posts a median', () => {
    const { competitors } = buildFormatEvidence([post({ views: 5 }), post({ views: 5000 })], []);

    expect(competitors[0].posts).toBe(2);
    expect(competitors[0].medianViews).toBeNull();
  });

  // Dividing by a fixed window would report a channel that stopped as silent,
  // when the finding is that it stopped.
  it('measures cadence across the span the posts themselves cover', () => {
    const { competitors } = buildFormatEvidence(
      [post({ publishedAt: day(1) }), post({ publishedAt: day(8) }), post({ publishedAt: day(15) })],
      [],
    );

    expect(competitors[0].postsPerWeek).toBe(1.5);
  });

  it('names the formats rivals use that the customer publishes none of', () => {
    const evidence = buildFormatEvidence(
      [post({ contentType: 'REEL' }), post({ platform: 'YOUTUBE', contentType: 'SHORT' })],
      [post({ contentType: 'REEL' })],
    );

    expect(evidence.formatsTheyUseYouDoNot).toEqual(['YOUTUBE_SHORT']);
  });

  it('says plainly when there is nothing on either side to reason from', () => {
    const evidence = buildFormatEvidence([], []);

    expect(evidence.competitors).toEqual([]);
    expect(evidence.notes).toHaveLength(2);
    expect(evidence.notes[0]).toContain('No competitor posts have been collected');
  });

  it('points at the best-performing post so a plan can name something real', () => {
    const { competitors } = buildFormatEvidence(
      [
        post({ views: 100, headline: 'quiet one' }),
        post({ views: 9000, headline: 'Farm to door in 12 hours' }),
        post({ views: 500, headline: 'middling' }),
      ],
      [],
    );

    expect(competitors[0].topExample).toBe('Farm to door in 12 hours');
  });
});

describe('describeFormats', () => {
  it('writes only the figures that were actually reported', () => {
    const { competitors } = buildFormatEvidence(
      [
        post({ views: null, likes: 50, publishedAt: day(1) }),
        post({ views: null, likes: 100, publishedAt: day(8) }),
        post({ views: null, likes: 150, publishedAt: day(15) }),
      ],
      [],
    );

    const [line] = describeFormats(competitors);
    expect(line).toContain('median 100 likes');
    expect(line).not.toContain('views');
  });
});
