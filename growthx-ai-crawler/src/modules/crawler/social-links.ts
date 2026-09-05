/**
 * Social profiles published on a page, read from the links the crawl already found.
 *
 * The crawler sees every outbound link on every page it fetches, and a
 * business's own social profiles are among them — almost always in the footer,
 * which is how they end up on every page of the site. Nothing was reading them:
 * `analyzeLinks` classified them as external and the result was discarded, so
 * the only social discovery in the product re-fetched a site's homepage over
 * HTTP to look for links the crawl had already had in hand and thrown away.
 *
 * Recognising them here means a customer's own accounts and a competitor's are
 * found the same way, from the same evidence, with no second fetch of anyone's
 * site.
 */

export type SocialPlatform =
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'YOUTUBE'
  | 'LINKEDIN'
  | 'TWITTER'
  | 'TIKTOK';

export interface SocialProfileLink {
  platform: SocialPlatform;
  /** `@name` for handle platforms, `company/name` for LinkedIn, the page name for Facebook. */
  handle: string;
  /** Canonical profile URL, rebuilt from the handle rather than kept as found. */
  profileUrl: string;
}

/**
 * First path segment of a social URL that is a platform route, not an account.
 *
 * A share button links to `facebook.com/sharer`, an article to
 * `instagram.com/p/<id>`, a video to `youtube.com/watch`. Every one of those is
 * a link to the platform rather than to anybody's profile, and treating them as
 * handles is how a site ends up "having" an account called `sharer`.
 */
const PLATFORM_ROUTES = new Set([
  'about', 'accounts', 'ads', 'business', 'channel', 'developer', 'developers',
  'dialog', 'direct', 'embed', 'events', 'explore', 'feed', 'groups', 'hashtag',
  'help', 'home', 'i', 'intent', 'legal', 'login', 'p', 'pages', 'photo',
  'playlist', 'plugins', 'policies', 'privacy', 'profile.php', 'reel', 'reels',
  'results', 'search', 'settings', 'share', 'sharer', 'shorts', 'signup',
  'stories', 'story', 'terms', 'tos', 'tr', 'watch', 'help-center',
]);

interface PlatformRule {
  platform: SocialPlatform;
  /** Hostnames that serve this platform, without any `www.` prefix. */
  hosts: string[];
  /** Turns the URL path into a stored handle, or null when it names no account. */
  handleFrom(segments: string[]): string | null;
  profileUrl(handle: string): string;
}

const RULES: PlatformRule[] = [
  {
    platform: 'INSTAGRAM',
    hosts: ['instagram.com'],
    handleFrom: (s) => atHandle(s[0], /^[A-Za-z0-9._]{1,30}$/),
    profileUrl: (h) => `https://www.instagram.com/${h.slice(1)}/`,
  },
  {
    platform: 'FACEBOOK',
    hosts: ['facebook.com', 'fb.com', 'web.facebook.com', 'm.facebook.com'],
    // Facebook pages are not handles and are not written with an `@` anywhere
    // the platform itself displays them, so they are stored as the page name.
    handleFrom: (s) => (isAccountSegment(s[0], /^[A-Za-z0-9.\-]{2,60}$/) ? s[0] : null),
    profileUrl: (h) => `https://www.facebook.com/${h}`,
  },
  {
    platform: 'YOUTUBE',
    hosts: ['youtube.com', 'm.youtube.com'],
    handleFrom: (s) => youtubeHandle(s),
    profileUrl: (h) => `https://www.youtube.com/${h}`,
  },
  {
    platform: 'LINKEDIN',
    hosts: ['linkedin.com'],
    handleFrom: (s) => linkedinHandle(s),
    profileUrl: (h) => `https://www.linkedin.com/${h}/`,
  },
  {
    platform: 'TWITTER',
    hosts: ['twitter.com', 'x.com', 'mobile.twitter.com'],
    handleFrom: (s) => atHandle(s[0], /^[A-Za-z0-9_]{1,15}$/),
    profileUrl: (h) => `https://twitter.com/${h.slice(1)}`,
  },
  {
    platform: 'TIKTOK',
    hosts: ['tiktok.com'],
    // TikTok writes the `@` into the path itself: /@growthx.
    handleFrom: (s) => (s[0]?.startsWith('@') ? atHandle(s[0].slice(1), /^[A-Za-z0-9._]{1,24}$/) : null),
    profileUrl: (h) => `https://www.tiktok.com/${h}`,
  },
];

function isAccountSegment(segment: string | undefined, shape: RegExp): boolean {
  if (!segment) return false;
  if (PLATFORM_ROUTES.has(segment.toLowerCase())) return false;
  return shape.test(segment);
}

function atHandle(segment: string | undefined, shape: RegExp): string | null {
  const bare = segment?.startsWith('@') ? segment.slice(1) : segment;
  return isAccountSegment(bare, shape) ? `@${bare}` : null;
}

/**
 * YouTube has four channel URL shapes and only the `@handle` one is current.
 *
 * `/channel/<id>` and `/c/<name>` and `/user/<name>` are all still published on
 * real sites, so all four are recognised and each is stored in the form the
 * platform will actually resolve.
 */
function youtubeHandle(segments: string[]): string | null {
  const [first, second] = segments;
  if (!first) return null;

  if (first.startsWith('@')) return atHandle(first.slice(1), /^[A-Za-z0-9._\-]{3,30}$/);

  const prefix = first.toLowerCase();
  if (prefix === 'channel' || prefix === 'c' || prefix === 'user') {
    if (!second || !/^[A-Za-z0-9._\-]{2,60}$/.test(second)) return null;
    return `${prefix}/${second}`;
  }

  return null;
}

/** LinkedIn distinguishes a company page from a person's profile in the path. */
function linkedinHandle(segments: string[]): string | null {
  const [first, second] = segments;
  const prefix = first?.toLowerCase();
  if (prefix !== 'company' && prefix !== 'in' && prefix !== 'school') return null;
  if (!second || !/^[A-Za-z0-9._%\-]{2,100}$/.test(second)) return null;
  return `${prefix}/${second}`;
}

/**
 * Reads the social profiles out of a set of outbound URLs.
 *
 * Order is preserved and duplicates are dropped case-insensitively, so a footer
 * link repeated in the header yields one profile rather than two.
 */
export function extractSocialProfiles(urls: Iterable<string>): SocialProfileLink[] {
  const found = new Map<string, SocialProfileLink>();

  for (const raw of urls) {
    const profile = readSocialProfile(raw);
    if (!profile) continue;

    const key = `${profile.platform}:${profile.handle.toLowerCase()}`;
    if (!found.has(key)) found.set(key, profile);
  }

  return [...found.values()];
}

/** Reads one URL, returning the profile it names or null if it names none. */
export function readSocialProfile(raw: string): SocialProfileLink | null {
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const rule = RULES.find((r) => r.hosts.includes(host) || r.hosts.includes(countryStripped(host)));
  if (!rule) return null;

  const segments = parsed.pathname.split('/').filter(Boolean).map(decodeSegment);
  if (segments.length === 0) return null;

  const handle = rule.handleFrom(segments);
  if (!handle) return null;

  return { platform: rule.platform, handle, profileUrl: rule.profileUrl(handle) };
}

/**
 * Drops a country subdomain, which LinkedIn puts on links from outside the US.
 *
 * A footer built in Mumbai links to `in.linkedin.com/company/x` and one built
 * in London to `uk.linkedin.com/company/x`; both name the same page, and
 * neither is reachable by an exact-host match.
 */
function countryStripped(host: string): string {
  return /^[a-z]{2}\./.test(host) ? host.slice(3) : host;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
