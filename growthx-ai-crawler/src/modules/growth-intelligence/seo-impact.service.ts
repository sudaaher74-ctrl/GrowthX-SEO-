import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { pathKey } from '../integrations/google/analytics-insights.service';
import { compareSnapshots, explain, MetricChange, Snapshot } from './impact-compare';

const DAY = 24 * 60 * 60 * 1000;
/** Days after going live before a comparison is offered: search data settles slowly. */
export const MIN_DAYS_AFTER = 14;

const day = (d: Date) => d.toISOString().slice(0, 10);
const ratio = (num: number, den: number) => (den > 0 ? num / den : 0);

/**
 * The before / after record: capture the figures when a change is planned,
 * note when it goes live, and compare once search data has had time to settle.
 * Reads stored data only; scoped to one project.
 */
@Injectable()
export class SeoImpactService {
  constructor(private readonly prisma: PrismaService) {}

  async plan(
    organizationId: string,
    projectId: string,
    userId: string | undefined,
    input: { url?: string | null; findingType: string; action: string; note?: string; windowDays?: number },
  ) {
    await this.assertProject(organizationId, projectId);
    const windowDays = [7, 28, 90].includes(input.windowDays ?? 28) ? (input.windowDays ?? 28) : 28;
    const action = (input.action ?? '').trim();
    const findingType = (input.findingType ?? '').trim();
    if (!action || !findingType) throw new BadRequestException('findingType and action are required.');
    const url = input.url ? input.url.trim() : null;

    const end = new Date();
    const baseline = await this.snapshot(projectId, url, new Date(end.getTime() - windowDays * DAY), end, windowDays);
    return this.prisma.seoImpactRecord.create({
      data: { projectId, createdById: userId ?? null, url, findingType, action: action.slice(0, 500), note: input.note?.slice(0, 1000), windowDays, baseline: baseline as any },
    });
  }

  async markImplemented(organizationId: string, projectId: string, id: string, implementedAt?: string) {
    await this.assertProject(organizationId, projectId);
    const record = await this.prisma.seoImpactRecord.findFirst({ where: { id, projectId } });
    if (!record) throw new NotFoundException('Impact record not found');
    const at = implementedAt ? new Date(implementedAt) : new Date();
    if (Number.isNaN(at.getTime()) || at.getTime() > Date.now() + DAY) throw new BadRequestException('implementedAt must be a valid date that is not in the future.');
    return this.prisma.seoImpactRecord.update({ where: { id }, data: { status: 'IMPLEMENTED', implementedAt: at } });
  }

  async list(organizationId: string, projectId: string) {
    await this.assertProject(organizationId, projectId);
    const rows = await this.prisma.seoImpactRecord.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, url: true, findingType: true, action: true, note: true, status: true, windowDays: true, createdAt: true, implementedAt: true },
    });
    return rows.map((r) => ({ ...r, readiness: this.readiness(r.status, r.implementedAt) }));
  }

  /** The comparison for one record, or the reason there is none yet. */
  async measure(organizationId: string, projectId: string, id: string) {
    await this.assertProject(organizationId, projectId);
    const record = await this.prisma.seoImpactRecord.findFirst({ where: { id, projectId } });
    if (!record) throw new NotFoundException('Impact record not found');

    const head = { id: record.id, url: record.url, findingType: record.findingType, action: record.action, note: record.note, status: record.status, implementedAt: record.implementedAt, createdAt: record.createdAt };
    const readiness = this.readiness(record.status, record.implementedAt);
    const before = record.baseline as unknown as Snapshot;
    if (readiness.state !== 'READY') return { ...head, readiness, before, after: null as Snapshot | null, changes: [] as MetricChange[], explanation: null as ReturnType<typeof explain> | null };

    const now = new Date();
    const start = new Date(Math.max(record.implementedAt!.getTime(), now.getTime() - record.windowDays * DAY));
    const days = Math.max(1, Math.round((now.getTime() - start.getTime()) / DAY));
    const after = await this.snapshot(projectId, record.url, start, now, days);
    const changes = compareSnapshots(before, after, Boolean(record.url));

    // Other changes made in the same period: named, not weighed. They are the
    // reason a before/after comparison cannot claim cause.
    const others = await this.prisma.seoImpactRecord.findMany({
      where: {
        projectId,
        id: { not: record.id },
        status: 'IMPLEMENTED',
        implementedAt: { gte: new Date(before.capturedAt), lte: now },
        OR: [{ url: record.url }, { url: null }, ...(record.url ? [] : [{ url: { not: null } }])],
      },
      select: { url: true, action: true, implementedAt: true },
      orderBy: { implementedAt: 'asc' },
    });
    const contributors = others.map((o) => `${o.action}${o.url ? ` (${pathKey(o.url)})` : ' (site-wide)'}, live ${day(o.implementedAt!)}`);

    return { ...head, readiness, before, after, changes, explanation: explain(changes, contributors) };
  }

  private readiness(status: string, implementedAt: Date | null) {
    if (status !== 'IMPLEMENTED' || !implementedAt) {
      return { state: 'NOT_IMPLEMENTED' as const, message: 'Mark the change as implemented once it is live; the comparison starts from that date.', measurableFrom: null as string | null };
    }
    const from = new Date(implementedAt.getTime() + MIN_DAYS_AFTER * DAY);
    if (Date.now() < from.getTime()) {
      return { state: 'TOO_EARLY' as const, message: `Search and Analytics data need time to settle. A comparison is offered from ${day(from)}.`, measurableFrom: day(from) };
    }
    return { state: 'READY' as const, message: 'Enough time has passed to compare.', measurableFrom: day(from) };
  }

  private async assertProject(organizationId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, organizationId }, select: { id: true } });
    if (!project) throw new NotFoundException('Project not found');
  }

  // ── Snapshots ───────────────────────────────────────────────────────────

  async snapshot(projectId: string, url: string | null, start: Date, end: Date, days: number): Promise<Snapshot> {
    const range = { gte: start, lte: end };
    const key = url ? pathKey(url) : null;

    const [gscTotal, ga4Total, gbp, checks] = await Promise.all([
      this.prisma.gscDailyMetric.findMany({ where: { projectId, grain: 'TOTAL', date: range }, select: { clicks: true, impressions: true, position: true } }),
      this.prisma.ga4DailyMetric.findMany({ where: { projectId, grain: 'TOTAL', date: range }, select: { sessions: true, engagementRate: true, conversions: true } }),
      this.prisma.gbpDailyMetric.groupBy({
        by: ['metric'],
        where: { projectId, date: range, metric: { in: ['WEBSITE_CLICKS', 'CALL_CLICKS', 'BUSINESS_DIRECTION_REQUESTS'] } },
        _sum: { value: true },
      }),
      this.prisma.promptCheck.findMany({ where: { trackedPrompt: { projectId }, checkedAt: range, error: null }, select: { cited: true } }),
    ]);

    let pageBlock: Snapshot['page'] = null;
    if (key) {
      const [gscRows, ga4Rows] = await Promise.all([
        this.prisma.gscDailyMetric.findMany({ where: { projectId, grain: 'PAGE', date: range, page: { contains: key === '/' ? '' : key } }, select: { page: true, clicks: true, impressions: true, position: true } }),
        this.prisma.ga4DailyMetric.findMany({ where: { projectId, grain: 'LANDING_PAGE', date: range, landingPage: { contains: key === '/' ? '' : key } }, select: { landingPage: true, sessions: true, engagementRate: true, conversions: true } }),
      ]);
      pageBlock = {
        gsc: this.searchFigures(gscRows.filter((r) => r.page && pathKey(r.page) === key)),
        ga4: this.visitFigures(ga4Rows.filter((r) => r.landingPage && pathKey(r.landingPage) === key)),
      };
    }

    const g = new Map(gbp.map((r) => [r.metric, r._sum.value ?? 0]));
    return {
      capturedAt: new Date().toISOString(),
      range: { start: day(start), end: day(end), days },
      page: pageBlock,
      site: {
        gsc: this.searchFigures(gscTotal),
        ga4: this.visitFigures(ga4Total),
        gbp: gbp.length ? { websiteClicks: g.get('WEBSITE_CLICKS') ?? 0, calls: g.get('CALL_CLICKS') ?? 0, directions: g.get('BUSINESS_DIRECTION_REQUESTS') ?? 0 } : null,
        ai: checks.length ? { checks: checks.length, citedChecks: checks.filter((c) => c.cited).length, ratePct: ratio(checks.filter((c) => c.cited).length, checks.length) * 100 } : null,
      },
    };
  }

  private searchFigures(rows: { clicks: number; impressions: number; position: number }[]) {
    if (rows.length === 0) return null;
    const clicks = rows.reduce((s, r) => s + r.clicks, 0);
    const impressions = rows.reduce((s, r) => s + r.impressions, 0);
    const weighted = rows.reduce((s, r) => s + r.position * r.impressions, 0);
    return { clicks, impressions, ctr: ratio(clicks, impressions), position: impressions > 0 ? weighted / impressions : 0 };
  }

  private visitFigures(rows: { sessions: number; engagementRate: number; conversions: number | null }[]) {
    if (rows.length === 0) return null;
    const sessions = rows.reduce((s, r) => s + r.sessions, 0);
    const engaged = rows.reduce((s, r) => s + r.sessions * r.engagementRate, 0);
    const configured = rows.some((r) => r.conversions !== null);
    return {
      sessions,
      engagementRate: sessions > 0 ? engaged / sessions : null,
      // Null when no row carried a key-event count: not configured, not zero.
      conversions: configured ? rows.reduce((s, r) => s + (r.conversions ?? 0), 0) : null,
    };
  }
}
