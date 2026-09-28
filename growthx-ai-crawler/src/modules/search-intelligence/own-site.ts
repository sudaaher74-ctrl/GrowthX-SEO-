import { PrismaService } from '../../database/prisma.service';
import { USABLE_CRAWL } from '../crawler/crawl-selection';
import { OWN_SCOPE } from '../crawler/website-scope';

export interface OwnSite {
  website: { id: string; domain: string; url: string };
  /** The latest crawl that finished and read something, or null before the first one. */
  crawl: { id: string; createdAt: Date; finishedAt: Date | null } | null;
}

/**
 * The customer's own website and the crawl every screen here reads.
 *
 * Only the project's own record: a competitor's site is a separate record
 * belonging to whichever project tracks it, and must never stand in for this
 * one.
 */
export async function ownSite(prisma: PrismaService, projectId: string): Promise<OwnSite | null> {
  const website = await prisma.website.findFirst({
    where: { projectId, scope: OWN_SCOPE },
    orderBy: { createdAt: 'asc' },
    select: { id: true, domain: true, url: true },
  });
  if (!website) return null;

  const crawl = await prisma.crawlJob.findFirst({
    where: { websiteId: website.id, ...USABLE_CRAWL },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, finishedAt: true },
  });
  return { website, crawl };
}

/** A bare, lower-case hostname without `www.`, or null for something that is not a URL or domain. */
export function bareDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    const host = new URL(/^[a-z]+:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`).hostname;
    return host.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

/** Whether a URL is on the given domain or one of its subdomains. */
export function onDomain(url: string, domain: string): boolean {
  const host = bareDomain(url);
  const target = bareDomain(domain);
  if (!host || !target) return false;
  return host === target || host.endsWith(`.${target}`);
}
