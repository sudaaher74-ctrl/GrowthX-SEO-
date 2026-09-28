import { PrismaService } from '../../database/prisma.service';
import { canonicalUrl } from '../crawler/canonical-url';

export interface SearchTotals {
  clicks: number;
  impressions: number;
  /** clicks / impressions, 0 when there were no impressions. */
  ctr: number;
  /** Impression-weighted average position, null with no impressions. */
  position: number | null;
}

export interface PageForQuery extends SearchTotals {
  url: string;
}

export interface QueryForPage extends SearchTotals {
  query: string;
}

const DAY = 24 * 60 * 60 * 1000;

/** Whether the project has a Search Console property selected. */
export async function searchConsoleConnected(prisma: PrismaService, projectId: string): Promise<boolean> {
  const integration = await prisma.integration.findUnique({
    where: { projectId_provider: { projectId, provider: 'search_console' } },
    select: { selectedResourceId: true },
  });
  return Boolean(integration?.selectedResourceId);
}

function totals(rows: Array<{ clicks: number; impressions: number; position: number }>): SearchTotals {
  let clicks = 0;
  let impressions = 0;
  let weighted = 0;
  for (const r of rows) {
    clicks += r.clicks;
    impressions += r.impressions;
    weighted += r.position * r.impressions;
  }
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: impressions > 0 ? Math.round((weighted / impressions) * 10) / 10 : null,
  };
}

/** Every stored spelling of a URL that is the same page: http/https, www, trailing slash. */
function samePage(url: string) {
  return (candidate: string | null) => candidate !== null && canonicalUrl(candidate) === canonicalUrl(url);
}

/**
 * One search's numbers over the last `days`, and which of the customer's
 * pages Google showed for it.
 */
export async function keywordInSearchConsole(
  prisma: PrismaService,
  projectId: string,
  keyword: string,
  days = 28,
): Promise<(SearchTotals & { pages: PageForQuery[] }) | null> {
  if (!(await searchConsoleConnected(prisma, projectId))) return null;
  const since = new Date(Date.now() - days * DAY);
  const query = { equals: keyword.trim(), mode: 'insensitive' as const };

  const [queryRows, pageRows] = await Promise.all([
    prisma.gscDailyMetric.findMany({
      where: { projectId, grain: 'QUERY', query, date: { gte: since } },
      select: { clicks: true, impressions: true, position: true },
    }),
    prisma.gscDailyMetric.findMany({
      where: { projectId, grain: 'QUERY_PAGE', query, date: { gte: since } },
      select: { page: true, clicks: true, impressions: true, position: true },
    }),
  ]);

  const byPage = new Map<string, { url: string; rows: typeof pageRows }>();
  for (const row of pageRows) {
    if (!row.page) continue;
    const key = canonicalUrl(row.page);
    const entry = byPage.get(key) ?? { url: row.page, rows: [] };
    entry.rows.push(row);
    byPage.set(key, entry);
  }
  const pages = [...byPage.values()]
    .map(({ url, rows }) => ({ url, ...totals(rows) }))
    .sort((a, b) => b.impressions - a.impressions);

  return { ...totals(queryRows), pages };
}

/** One page's numbers over a date window [from, to). */
export async function pageInSearchConsole(prisma: PrismaService, projectId: string, url: string, from: Date, to: Date): Promise<SearchTotals & { days: number }> {
  const rows = await prisma.gscDailyMetric.findMany({
    where: { projectId, grain: 'PAGE', date: { gte: from, lt: to }, page: { contains: pathOf(url) } },
    select: { page: true, date: true, clicks: true, impressions: true, position: true },
  });
  const mine = rows.filter((r) => samePage(url)(r.page));
  return { ...totals(mine), days: new Set(mine.map((r) => r.date.toISOString().slice(0, 10))).size };
}

/** The searches that bring a page its visitors, most clicked first. */
export async function queriesForPage(prisma: PrismaService, projectId: string, url: string, days = 90, limit = 25): Promise<QueryForPage[]> {
  const since = new Date(Date.now() - days * DAY);
  const rows = await prisma.gscDailyMetric.findMany({
    where: { projectId, grain: 'QUERY_PAGE', date: { gte: since }, page: { contains: pathOf(url) } },
    select: { page: true, query: true, clicks: true, impressions: true, position: true },
  });
  const byQuery = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.query || !samePage(url)(row.page)) continue;
    const list = byQuery.get(row.query) ?? [];
    list.push(row);
    byQuery.set(row.query, list);
  }
  return [...byQuery.entries()]
    .map(([query, list]) => ({ query, ...totals(list) }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, limit);
}

/** Site-wide totals over [from, to), the baseline a single page's change is read against. */
export async function siteInSearchConsole(prisma: PrismaService, projectId: string, from: Date, to: Date): Promise<SearchTotals & { days: number }> {
  const rows = await prisma.gscDailyMetric.findMany({
    where: { projectId, grain: 'TOTAL', date: { gte: from, lt: to } },
    select: { date: true, clicks: true, impressions: true, position: true },
  });
  return { ...totals(rows), days: new Set(rows.map((r) => r.date.toISOString().slice(0, 10))).size };
}

/** The newest day Search Console data is held for, or null. */
export async function latestSearchConsoleDay(prisma: PrismaService, projectId: string): Promise<Date | null> {
  const row = await prisma.gscDailyMetric.findFirst({ where: { projectId, grain: 'TOTAL' }, orderBy: { date: 'desc' }, select: { date: true } });
  return row?.date ?? null;
}

/** The path part of a URL, used to narrow a query before exact page matching. */
function pathOf(url: string): string {
  try {
    const path = new URL(url).pathname.replace(/\/+$/, '');
    return path || '/';
  } catch {
    return url;
  }
}
