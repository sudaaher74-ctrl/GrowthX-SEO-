import { extractSocialProfiles, readSocialProfile } from './social-links';

describe('readSocialProfile', () => {
  it('reads an Instagram handle', () => {
    expect(readSocialProfile('https://www.instagram.com/growthx.ai/')).toEqual({
      platform: 'INSTAGRAM',
      handle: '@growthx.ai',
      profileUrl: 'https://www.instagram.com/growthx.ai/',
    });
  });

  it('reads every YouTube channel URL shape the web still publishes', () => {
    expect(readSocialProfile('https://youtube.com/@growthx')?.handle).toBe('@growthx');
    expect(readSocialProfile('https://www.youtube.com/c/GrowthX')?.handle).toBe('c/GrowthX');
    expect(readSocialProfile('https://www.youtube.com/user/growthx')?.handle).toBe('user/growthx');
    expect(readSocialProfile('https://www.youtube.com/channel/UC12345abcde')?.handle).toBe(
      'channel/UC12345abcde',
    );
  });

  it('keeps a LinkedIn company page distinct from a person', () => {
    expect(readSocialProfile('https://in.linkedin.com/company/growthx')?.handle).toBe('company/growthx');
    expect(readSocialProfile('https://www.linkedin.com/in/some-founder')?.handle).toBe('in/some-founder');
  });

  it('reads x.com as Twitter', () => {
    expect(readSocialProfile('https://x.com/growthx')).toEqual({
      platform: 'TWITTER',
      handle: '@growthx',
      profileUrl: 'https://twitter.com/growthx',
    });
  });

  it('reads a TikTok handle out of the path', () => {
    expect(readSocialProfile('https://www.tiktok.com/@growthx.ai')?.handle).toBe('@growthx.ai');
  });

  it('stores a Facebook page under the name the platform uses, with no @', () => {
    expect(readSocialProfile('https://www.facebook.com/GrowthXIndia')).toEqual({
      platform: 'FACEBOOK',
      handle: 'GrowthXIndia',
      profileUrl: 'https://www.facebook.com/GrowthXIndia',
    });
  });

  // Share buttons are on more sites than profile links are, so a scanner that
  // does not reject them reports that every site on the web has an account
  // called "sharer" or "intent".
  it.each([
    'https://www.facebook.com/sharer/sharer.php?u=https://client.com',
    'https://twitter.com/intent/tweet?text=hello',
    'https://www.instagram.com/p/CabcdefGh/',
    'https://www.instagram.com/reel/CabcdefGh/',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.linkedin.com/shareArticle?mini=true',
    'https://www.facebook.com/plugins/like.php',
  ])('rejects the platform route %s', (url) => {
    expect(readSocialProfile(url)).toBeNull();
  });

  it('ignores links to anything that is not a social platform', () => {
    expect(readSocialProfile('https://client.com/contact')).toBeNull();
    expect(readSocialProfile('https://maps.google.com/place/x')).toBeNull();
  });

  it('ignores a platform link that names no account at all', () => {
    expect(readSocialProfile('https://www.instagram.com/')).toBeNull();
    expect(readSocialProfile('https://www.youtube.com')).toBeNull();
  });

  it('survives a malformed href rather than throwing mid-crawl', () => {
    expect(readSocialProfile('ht!tp://%%%')).toBeNull();
    expect(readSocialProfile('')).toBeNull();
  });
});

describe('extractSocialProfiles', () => {
  it('returns one profile per account however many pages linked to it', () => {
    const profiles = extractSocialProfiles([
      'https://instagram.com/growthx',
      'https://www.instagram.com/GrowthX/',
      'https://www.instagram.com/growthx?hl=en',
    ]);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].handle).toBe('@growthx');
  });

  it('reads a whole footer, keeping each platform separate', () => {
    const profiles = extractSocialProfiles([
      'https://client.com/privacy',
      'https://www.facebook.com/ClientCo',
      'https://www.instagram.com/clientco/',
      'https://www.youtube.com/@clientco',
      'https://www.linkedin.com/company/clientco',
      'https://twitter.com/clientco',
      'https://www.facebook.com/sharer/sharer.php',
    ]);

    expect(profiles.map((p) => p.platform)).toEqual([
      'FACEBOOK',
      'INSTAGRAM',
      'YOUTUBE',
      'LINKEDIN',
      'TWITTER',
    ]);
  });

  it('returns nothing for a site that publishes no social links', () => {
    expect(extractSocialProfiles(['https://client.com/', 'https://client.com/about'])).toEqual([]);
  });
});
