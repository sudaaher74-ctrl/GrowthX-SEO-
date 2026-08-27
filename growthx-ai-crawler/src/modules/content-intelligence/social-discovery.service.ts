import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface DiscoveredAccount {
  platform: string;
  handle: string;
  profileUrl: string;
}

/**
 * Where a site is most likely to list its own social profiles. The homepage
 * carries them in the footer on almost every site; the others are checked only
 * when it yields nothing, so the common case costs one request.
 */
const FALLBACK_PATHS = ['/contact', '/about', '/contact-us', '/about-us'];

/**
 * Recognised profile URLs, per platform.
 *
 * Anchored to the host so a link merely *mentioning* a platform elsewhere in
 * the page does not match, and the capture stops at the first path segment
 * because everything after it is a post, a tab or a query string rather than
 * part of the handle.
 */
const PATTERNS: { platform: string; pattern: RegExp }[] = [
  { platform: 'INSTAGRAM', pattern: /https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)/gi },
  { platform: 'FACEBOOK', pattern: /https?:\/\/(?:www\.|web\.)?facebook\.com\/([A-Za-z0-9.\-]+)/gi },
  { platform: 'YOUTUBE', pattern: /https?:\/\/(?:www\.)?youtube\.com\/((?:@|c\/|channel\/|user\/)[A-Za-z0-9._\-]+)/gi },
  // `www` as well as the two-letter country subdomains (in., uk., de.):
  // matching only the latter missed the form most sites actually use.
  //
  // Personal profiles (`/in/`) count alongside company pages. A small B2B
  // exporter often has no company page at all and links its founder instead —
  // which is the only real profile on either of the first two sites this was
  // tried against, so excluding it would have found nothing on both.
  {
    platform: 'LINKEDIN',
    pattern: /https?:\/\/(?:(?:www|[a-z]{2})\.)?linkedin\.com\/((?:company|in)\/[A-Za-z0-9._\-]+)/gi,
  },
  { platform: 'TWITTER', pattern: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/([A-Za-z0-9_]+)/gi },
];

/**
 * Path segments that look like handles but are not.
 *
 * Share buttons are the reason this exists: nearly every site links
 * `facebook.com/sharer/sharer.php` and `twitter.com/intent/tweet`, and taking
 * those as profiles would register "sharer" and "intent" as competitors on
 * every single site.
 */
const NOT_HANDLES = new Set([
  'sharer', 'share', 'intent', 'home', 'login', 'signup', 'privacy', 'policies',
  'tos', 'help', 'about', 'pages', 'groups', 'events', 'watch', 'search',
  'hashtag', 'explore', 'reels', 'p', 'tr', 'plugins', 'dialog', 'profile.php',
]);

@Injectable()
export class SocialDiscoveryService {
  private readonly logger = new Logger(SocialDiscoveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reads a competitor's own site for the social profiles it publishes, and
   * registers them for content ingestion.
   *
   * Adding a competitor previously recorded a domain and nothing else: their
   * social accounts had to be typed in by hand before any of the intelligence
   * pipeline could run, which is a step nobody completes. A brand lists its own
   * handles in its footer, so the domain is enough to find them.
   */
  async discoverAccounts(
    organizationId: string,
    projectId: string,
    competitorId: string,
    domain: string,
  ): Promise<{ discovered: DiscoveredAccount[]; saved: number }> {
    const html = await this.fetchSiteHtml(domain);
    if (!html) return { discovered: [], saved: 0 };

    const discovered = this.extractAccounts(html);
    if (discovered.length === 0) {
      this.logger.log(`No social profiles found on ${domain}.`);
      return { discovered: [], saved: 0 };
    }

    let saved = 0;
    for (const account of discovered) {
      try {
        await this.prisma.competitorAccount.upsert({
          where: {
            projectId_platform_handle: {
              projectId,
              platform: account.platform,
              handle: account.handle,
            },
          },
          // An account already registered keeps whatever sync state it has;
          // rediscovering it must not reset lastSyncedAt or follower counts.
          update: { profileUrl: account.profileUrl, isActive: true },
          create: {
            organizationId,
            projectId,
            competitorId,
            platform: account.platform,
            handle: account.handle,
            profileUrl: account.profileUrl,
          },
        });
        saved++;
      } catch (error) {
        this.logger.warn(`Could not save ${account.platform} account ${account.handle}: ${error}`);
      }
    }

    this.logger.log(`Discovered ${discovered.length} social profile(s) on ${domain}; ${saved} registered.`);
    return { discovered, saved };
  }

  /** Pulls the social profile links out of a page's markup. */
  extractAccounts(html: string): DiscoveredAccount[] {
    const byKey = new Map<string, DiscoveredAccount>();

    for (const { platform, pattern } of PATTERNS) {
      // A fresh regex per pass: these carry /g, so lastIndex would otherwise
      // persist between calls and skip matches on the second page checked.
      const scanner = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = scanner.exec(html)) !== null) {
        const raw = match[1];
        const handle = raw.replace(/\/$/, '');
        const leaf = handle.split('/').pop() ?? handle;

        if (!leaf || NOT_HANDLES.has(leaf.toLowerCase()) || NOT_HANDLES.has(handle.toLowerCase())) continue;
        if (leaf.length < 2) continue;

        const key = `${platform}:${handle.toLowerCase()}`;
        if (byKey.has(key)) continue;

        byKey.set(key, { platform, handle, profileUrl: match[0].replace(/\/$/, '') });
      }
    }

    return [...byKey.values()];
  }

  /**
   * Fetches the competitor's markup, trying the pages most likely to carry a
   * footer of links. Never throws: a competitor whose site is down or blocks us
   * should record a domain with no accounts, not fail the request that added it.
   */
  private async fetchSiteHtml(domain: string): Promise<string | null> {
    const base = domain.startsWith('http') ? domain : `https://${domain}`;

    for (const path of ['', ...FALLBACK_PATHS]) {
      try {
        const response = await fetch(`${base}${path}`, {
          redirect: 'follow',
          signal: AbortSignal.timeout(10_000),
          headers: { 'User-Agent': 'GrowthXBot/1.0 (+https://growthx.ai/bot)' },
        });
        if (!response.ok) continue;

        const html = await response.text();
        // Stop at the first page that actually names a platform; the fallbacks
        // exist for sites that keep their links off the homepage.
        if (PATTERNS.some(({ pattern }) => new RegExp(pattern.source, 'i').test(html))) {
          return html;
        }
      } catch (error) {
        this.logger.debug(`Could not read ${base}${path}: ${error}`);
      }
    }

    this.logger.log(`No readable page with social links on ${domain}.`);
    return null;
  }
}
