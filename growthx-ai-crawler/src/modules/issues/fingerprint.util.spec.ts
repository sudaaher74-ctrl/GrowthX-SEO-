import {
  fingerprintFor,
  fingerprintScope,
  issueFingerprint,
  normaliseUrl,
  siteFingerprint,
  SITE_WIDE_ISSUE_TYPES,
} from './fingerprint.util';

describe('normaliseUrl', () => {
  it('collapses protocol, www, trailing slash and tracking params to one string', () => {
    // The four spellings of one page. If any of these disagreed, a re-crawl
    // that happened to reach the page by a different route would report an
    // existing finding as new.
    const forms = [
      'http://www.x.com/a/',
      'https://x.com/a',
      'https://x.com/a?utm_source=google',
      'https://WWW.X.com/a/#section',
    ];
    const normalised = forms.map(normaliseUrl);
    expect(new Set(normalised).size).toBe(1);
  });

  it('drops every tracking parameter it knows about', () => {
    const base = normaliseUrl('https://x.com/a');
    for (const param of ['utm_source=g', 'utm_campaign=spring', 'fbclid=abc', 'gclid=xyz', 'msclkid=1', 'ref=partner']) {
      expect(normaliseUrl(`https://x.com/a?${param}`)).toBe(base);
    }
  });

  it('keeps a query string that selects different content', () => {
    // ?page=2 is a different page; ?utm_source=x is the same page. Collapsing
    // the first would merge two findings into one and hide half of them.
    expect(normaliseUrl('https://x.com/a?page=2')).not.toBe(normaliseUrl('https://x.com/a'));
  });

  it('orders query parameters so argument order cannot change identity', () => {
    expect(normaliseUrl('https://x.com/a?b=2&a=1')).toBe(normaliseUrl('https://x.com/a?a=1&b=2'));
  });

  it('preserves the root path rather than emptying it', () => {
    expect(normaliseUrl('https://x.com/')).toBe(normaliseUrl('https://x.com'));
    expect(normaliseUrl('https://x.com/')).toContain('x.com/');
  });

  it('returns something stable for malformed input instead of throwing', () => {
    expect(() => normaliseUrl('not a url')).not.toThrow();
    expect(normaliseUrl('  NOT A URL  ')).toBe(normaliseUrl('not a url'));
    expect(normaliseUrl('')).toBe('');
  });
});

describe('issueFingerprint', () => {
  it('is stable across repeated calls', () => {
    const a = issueFingerprint('proj-1', 'MISSING_TITLE', 'https://x.com/a');
    const b = issueFingerprint('proj-1', 'MISSING_TITLE', 'http://www.x.com/a/');
    expect(a).toBe(b);
  });

  it('separates projects, issue types and URLs', () => {
    const base = issueFingerprint('proj-1', 'MISSING_TITLE', 'https://x.com/a');
    expect(issueFingerprint('proj-2', 'MISSING_TITLE', 'https://x.com/a')).not.toBe(base);
    expect(issueFingerprint('proj-1', 'MISSING_H1', 'https://x.com/a')).not.toBe(base);
    expect(issueFingerprint('proj-1', 'MISSING_TITLE', 'https://x.com/b')).not.toBe(base);
  });
});

describe('siteFingerprint', () => {
  it('ignores the URL entirely', () => {
    // A site-wide defect is reported against whichever URL was fetched first,
    // which changes between crawls. Keying it by URL would report the same
    // robots.txt problem as new every time the entry point moved.
    expect(siteFingerprint('proj-1', 'INCORRECT_ROBOTS')).toBe(
      siteFingerprint('proj-1', 'INCORRECT_ROBOTS'),
    );
    expect(siteFingerprint('proj-1', 'INCORRECT_ROBOTS')).toContain('__site__');
  });
});

describe('fingerprintScope', () => {
  it('uses the project when there is one', () => {
    expect(fingerprintScope('proj-1', 'site-1')).toBe('proj-1');
  });

  it('falls back to the website for a competitor crawl, which has no project', () => {
    expect(fingerprintScope(null, 'site-1')).toBe('website:site-1');
    expect(fingerprintScope(undefined, 'site-1')).toBe('website:site-1');
  });

  it('keeps two projectless websites apart', () => {
    expect(fingerprintScope(null, 'site-1')).not.toBe(fingerprintScope(null, 'site-2'));
  });
});

describe('fingerprintFor', () => {
  it('routes site-wide types to the site fingerprint', () => {
    for (const type of SITE_WIDE_ISSUE_TYPES) {
      expect(fingerprintFor('proj-1', type, 'https://x.com/whatever')).toBe(
        siteFingerprint('proj-1', type),
      );
      // Same finding, different entry point, same name.
      expect(fingerprintFor('proj-1', type, 'https://x.com/a')).toBe(
        fingerprintFor('proj-1', type, 'https://x.com/b'),
      );
    }
  });

  it('routes everything else to the per-URL fingerprint', () => {
    expect(fingerprintFor('proj-1', 'MISSING_TITLE', 'https://x.com/a')).toBe(
      issueFingerprint('proj-1', 'MISSING_TITLE', 'https://x.com/a'),
    );
  });
});
