import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { canonicalUrl } from '../crawler/canonical-url';
import { readImpact, Window } from './change-impact';
import { onDomain, ownSite } from './own-site';
import {
  latestSearchConsoleDay,
  pageInSearchConsole,
  searchConsoleConnected,
  siteInSearchConsole,
} from './search-console-facts';

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_WINDOW_DAYS = 28;

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Search results before and after a change: clicks, impressions, click-through
 * rate and position from Search Console, visits from Google Analytics where
 * connected, and which searches moved, for any change the product knows about
 * or any URL and date the customer names.
 */
@Injectable()
export class ChangeImpactService {
  constructor(private readonly prisma: PrismaService) {}

  async forUrl(projectId: string, url: string, changedAt: Date, windowDays = DEFAULT_WINDOW_DAYS) {
    if (Number.isNaN(changedAt.getTime())) throw new BadRequestException('Give the date the change went live.');
    const days = Math.min(Math.max(7, windowDays), 90);

    if (!(await searchConsoleConnected(this.prisma, projectId))) {
      return { url, changedAt, status: 'NOT_CONNECTED' as const, message: 'Connect Google Search Console to measure what a change did to your search results.' };
    }
    const latest = await latestSearchConsoleDay(this.prisma, projectId);
    if (!latest) {
      return { url, changedAt, status: 'NO_DATA' as const, message: 'Search Console is connected but has not synced any data yet.' };
    }

    const changeDay = startOfDay(changedAt);
    const before = { from: new Date(changeDay.getTime() - days * DAY), to: changeDay };
    // The day of the change is mixed, so it counts on neither side.
    const afterFrom = new Date(changeDay.getTime() + DAY);
    const dataEnd = new Date(startOfDay(latest).getTime() + DAY);
    const after = { from: afterFrom, to: new Date(Math.min(afterFrom.getTime() + days * DAY, dataEnd.getTime())) };

    if (after.to <= after.from) {
      return {
        url,
        changedAt,
        status: 'TOO_EARLY' as const,
        message: `Search Console data runs to ${iso(latest)}, which is before the change took effect. Google reports with a 2 to 3 day delay.`,
      };
    }

    const [pageBefore, pageAfter, siteBefore, siteAfter, queriesBefore, queriesAfter, visits] = await Promise.all([
      pageInSearchConsole(this.prisma, projectId, url, before.from, before.to),
      pageInSearchConsole(this.prisma, projectId, url, after.from, after.to),
      siteInSearchConsole(this.prisma, projectId, before.from, before.to),
      siteInSearchConsole(this.prisma, projectId, after.from, after.to),
      this.queriesIn(projectId, url, before.from, before.to),
      this.queriesIn(projectId, url, after.from, after.to),
      this.visits(projectId, url, before, after),
    ]);

    const win = (range: { from: Date; to: Date }, t: { days: number; clicks: number; impressions: number; ctr: number; position: number | null }): Window => ({
      from: iso(range.from),
      to: iso(new Date(range.to.getTime() - DAY)),
      days: t.days,
      clicks: t.clicks,
      impressions: t.impressions,
      ctr: t.ctr,
      position: t.position,
    });
    const page = { before: win(before, pageBefore), after: win(after, pageAfter) };
    const site = { before: win(before, siteBefore), after: win(after, siteAfter) };

    return {
      url,
      changedAt,
      status: 'MEASURED' as const,
      windowDays: days,
      page,
      site,
      ...readImpact(page, site),
      searches: moverTable(queriesBefore, queriesAfter, pageBefore.days || 1, pageAfter.days || 1),
      visits,
    };
  }

  /** The change ledger (automated fixes and published edits) with each change's search impact. */
  async changes(projectId: string) {
    const [interventions, published] = await Promise.all([
      this.prisma.fixIntervention.findMany({
        where: { projectId, arm: 'TREAT' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, url: true, changeClass: true, summary: true, shippedAt: true, createdAt: true, pullRequestUrl: true },
      }),
      this.prisma.publishedChange.findMany({
        where: { projectId, status: { in: ['PUBLISHED', 'VERIFIED'] } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, pageUrl: true, publishedAt: true, createdAt: true, pullRequestUrl: true, suggestion: { select: { title: true } } },
      }),
    ]);

    const entries = [
      ...interventions.map((i) => ({
        id: i.id,
        kind: 'FIX' as const,
        url: i.url,
        what: i.summary ?? i.changeClass.replace(/_/g, ' ').toLowerCase(),
        liveSince: i.shippedAt,
        recordedAt: i.createdAt,
        pullRequestUrl: i.pullRequestUrl,
      })),
      ...published.map((p) => ({
        id: p.id,
        kind: 'CONTENT' as const,
        url: p.pageUrl,
        what: p.suggestion?.title ?? 'Content change',
        liveSince: p.publishedAt,
        recordedAt: p.createdAt,
        pullRequestUrl: p.pullRequestUrl,
      })),
    ].sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());

    const out = [];
    for (const e of entries.slice(0, 20)) {
      if (!e.liveSince) {
        out.push({ ...e, impact: { status: 'NOT_LIVE' as const, message: 'Not marked as live yet, so there is no date to measure from.' } });
        continue;
      }
      const impact = await this.forUrl(projectId, e.url, e.liveSince);
      out.push({
        ...e,
        impact:
          impact.status === 'MEASURED'
            ? { status: impact.status, verdict: impact.verdict, verdictText: impact.verdictText, perDay: impact.perDay, positionGain: impact.positionGain }
            : { status: impact.status, message: impact.message },
      });
    }
    return { changes: out };
  }

  /** Validates a customer-entered URL is theirs before it is measured. */
  async assertOwnUrl(projectId: string, url: string) {
    const site = await ownSite(this.prisma, projectId);
    if (!site) throw new BadRequestException('Add your website to this project first.');
    if (!onDomain(url, site.website.domain)) throw new BadRequestException(`${url} is not on ${site.website.domain}.`);
  }

  private async queriesIn(projectId: string, url: string, from: Date, to: Date) {
    const rows = await this.prisma.gscDailyMetric.findMany({
      where: { projectId, grain: 'QUERY_PAGE', date: { gte: from, lt: to }, query: { not: null } },
      select: { page: true, query: true, clicks: true, impressions: true, position: true },
    });
    const key = canonicalUrl(url);
    const byQuery = new Map<string, { clicks: number; impressions: number; weighted: number }>();
    for (const r of rows) {
      if (!r.page || canonicalUrl(r.page) !== key) continue;
      const a = byQuery.get(r.query!) ?? { clicks: 0, impressions: 0, weighted: 0 };
      a.clicks += r.clicks;
      a.impressions += r.impressions;
      a.weighted += r.position * r.impressions;
      byQuery.set(r.query!, a);
    }
    return byQuery;
  }

  /** Google Analytics sessions landing on the page, when Analytics is connected. */
  private async visits(projectId: string, url: string, before: { from: Date; to: Date }, after: { from: Date; to: Date }) {
    let path: string;
    try {
      path = new URL(url).pathname.replace(/\/+$/, '') || '/';
    } catch {
      return null;
    }
    const matches = (lp: string | null) => {
      if (!lp) return false;
      const bare = lp.split('?')[0].replace(/\/+$/, '') || '/';
      return bare === path;
    };
    const sum = async (range: { from: Date; to: Date }) => {
      const rows = await this.prisma.ga4DailyMetric.findMany({
        where: { projectId, grain: 'LANDING_PAGE', date: { gte: range.from, lt: range.to }, landingPage: { startsWith: path } },
        select: { landingPage: true, date: true, sessions: true, conversions: true },
      });
      const mine = rows.filter((r) => matches(r.landingPage));
      return {
        sessions: mine.reduce((s, r) => s + r.sessions, 0),
        conversions: mine.reduce((s, r) => s + (r.conversions ?? 0), 0),
        days: new Set(mine.map((r) => iso(r.date))).size,
      };
    };
    const connected = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: 'analytics' } },
      select: { selectedResourceId: true },
    });
    if (!connected?.selectedResourceId) return null;
    const [b, a] = await Promise.all([sum(before), sum(after)]);
    return { before: b, after: a };
  }
}

/** The searches that moved most for the page, per day so unequal windows compare. */
function moverTable(
  before: Map<string, { clicks: number; impressions: number; weighted: number }>,
  after: Map<string, { clicks: number; impressions: number; weighted: number }>,
  daysBefore: number,
  daysAfter: number,
) {
  const all = new Set([...before.keys(), ...after.keys()]);
  const rows = [...all].map((query) => {
    const b = before.get(query);
    const a = after.get(query);
    const pos = (x?: { impressions: number; weighted: number }) => (x && x.impressions > 0 ? Math.round((x.weighted / x.impressions) * 10) / 10 : null);
    return {
      query,
      clicksPerDayBefore: Math.round(((b?.clicks ?? 0) / daysBefore) * 100) / 100,
      clicksPerDayAfter: Math.round(((a?.clicks ?? 0) / daysAfter) * 100) / 100,
      impressionsBefore: b?.impressions ?? 0,
      impressionsAfter: a?.impressions ?? 0,
      positionBefore: pos(b),
      positionAfter: pos(a),
    };
  });
  const moved = (r: (typeof rows)[number]) => Math.abs(r.clicksPerDayAfter - r.clicksPerDayBefore) * 10 + Math.abs(r.impressionsAfter / daysAfter - r.impressionsBefore / daysBefore);
  return rows.sort((x, y) => moved(y) - moved(x)).slice(0, 15);
}
