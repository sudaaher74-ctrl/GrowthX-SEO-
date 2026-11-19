import {
  BadRequestException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { scheduledJobsEnabled } from '../scheduler/scheduler.module';
import {
  MonthlyReportPayload,
  WhiteLabelMeta,
  renderMonthlyReportHtml,
} from './monthly-report-pdf';

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

function previousMonthKey(now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function hostOfUrl(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./i, '');
  } catch {
    return raw;
  }
}

@Injectable()
export class MonthlyReportsService {
  private readonly logger = new Logger(MonthlyReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private assertMonth(month: string): string {
    const trimmed = (month ?? '').trim();
    if (!MONTH_PATTERN.test(trimmed)) {
      throw new BadRequestException('Month must be in YYYY-MM format (e.g. 2026-10).');
    }
    return trimmed;
  }

  private async assertProjectAccess(organizationId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      include: {
        websites: { select: { id: true, domain: true }, take: 1 },
        organization: {
          select: {
            whiteLabelEnabled: true,
            agencyName: true,
            logoUrl: true,
            brandColor: true,
            contactLine: true,
            footerText: true,
          },
        },
      },
    });
    if (!project) {
      throw new NotFoundException('Project not found in this organization.');
    }
    return project;
  }

  private buildWhiteLabel(org: {
    whiteLabelEnabled?: boolean | null;
    agencyName?: string | null;
    logoUrl?: string | null;
    brandColor?: string | null;
    contactLine?: string | null;
    footerText?: string | null;
  } | null): WhiteLabelMeta {
    return {
      enabled: Boolean(org?.whiteLabelEnabled),
      agencyName: org?.agencyName || 'GrowthX / Reigel AI',
      logoUrl: org?.logoUrl ?? null,
      brandColor: org?.brandColor || '#111827',
      contactLine: org?.contactLine ?? null,
      footerText: org?.footerText ?? null,
    };
  }

  async listSnapshots(organizationId: string, projectId: string) {
    await this.assertProjectAccess(organizationId, projectId);
    const rows = await this.prisma.monthlyReportSnapshot.findMany({
      where: { projectId, organizationId },
      orderBy: { month: 'desc' },
      select: {
        id: true,
        month: true,
        isLocked: true,
        lockedAt: true,
        agencyNotes: true,
        shareToken: true,
        shareExpiresAt: true,
        updatedAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      month: r.month,
      isLocked: r.isLocked,
      lockedAt: r.lockedAt?.toISOString() ?? null,
      hasNotes: Boolean(r.agencyNotes?.trim()),
      hasShareLink: Boolean(r.shareToken && (!r.shareExpiresAt || r.shareExpiresAt > new Date())),
      shareToken: r.shareToken,
      shareExpiresAt: r.shareExpiresAt?.toISOString() ?? null,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async getSnapshot(organizationId: string, projectId: string, rawMonth: string) {
    await this.assertProjectAccess(organizationId, projectId);
    const month = this.assertMonth(rawMonth);

    const row = await this.prisma.monthlyReportSnapshot.findUnique({
      where: { projectId_month: { projectId, month } },
    });
    if (!row) return null;

    return {
      id: row.id,
      projectId: row.projectId,
      month: row.month,
      isLocked: row.isLocked,
      lockedAt: row.lockedAt?.toISOString() ?? null,
      agencyNotes: row.agencyNotes ?? '',
      shareToken: row.shareToken,
      shareExpiresAt: row.shareExpiresAt?.toISOString() ?? null,
      payload: row.payload as unknown as MonthlyReportPayload,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async saveNotes(
    organizationId: string,
    projectId: string,
    rawMonth: string,
    agencyNotes: string,
  ) {
    await this.assertProjectAccess(organizationId, projectId);
    const month = this.assertMonth(rawMonth);
    const cleaned = String(agencyNotes ?? '').slice(0, 8000);

    const existing = await this.prisma.monthlyReportSnapshot.findUnique({
      where: { projectId_month: { projectId, month } },
    });

    if (existing) {
      const updated = await this.prisma.monthlyReportSnapshot.update({
        where: { id: existing.id },
        data: { agencyNotes: cleaned },
      });
      return {
        month: updated.month,
        agencyNotes: updated.agencyNotes ?? '',
        isLocked: updated.isLocked,
        updatedAt: updated.updatedAt.toISOString(),
      };
    }

    const serverPayload = await this.captureServerPayload(organizationId, projectId, month);
    const created = await this.prisma.monthlyReportSnapshot.create({
      data: {
        projectId,
        organizationId,
        month,
        payload: serverPayload as unknown as Prisma.InputJsonValue,
        agencyNotes: cleaned,
        isLocked: false,
      },
    });
    return {
      month: created.month,
      agencyNotes: created.agencyNotes ?? '',
      isLocked: created.isLocked,
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  /**
   * Freezes a monthly report snapshot for historical accuracy.
   * Subsequent views of past months read this exact frozen payload instead of drifting with today's live state.
   */
  async lockSnapshot(
    organizationId: string,
    projectId: string,
    rawMonth: string,
    input?: { payload?: Partial<MonthlyReportPayload>; agencyNotes?: string },
  ) {
    const project = await this.assertProjectAccess(organizationId, projectId);
    const month = this.assertMonth(rawMonth);

    const serverPayload = await this.captureServerPayload(organizationId, projectId, month);
    const mergedPayload: MonthlyReportPayload = {
      ...serverPayload,
      ...(input?.payload ?? {}),
      domain: project.websites[0]?.domain || project.name,
      month,
      monthLabel: formatMonthLabel(month),
      generatedAt: new Date().toISOString(),
      // White-label branding always comes from authoritative organization settings.
      whiteLabel: this.buildWhiteLabel(project.organization),
    };

    const now = new Date();
    const row = await this.prisma.monthlyReportSnapshot.upsert({
      where: { projectId_month: { projectId, month } },
      create: {
        projectId,
        organizationId,
        month,
        payload: mergedPayload as unknown as Prisma.InputJsonValue,
        agencyNotes: input?.agencyNotes?.slice(0, 8000) ?? null,
        isLocked: true,
        lockedAt: now,
      },
      update: {
        payload: mergedPayload as unknown as Prisma.InputJsonValue,
        ...(input?.agencyNotes !== undefined ? { agencyNotes: input.agencyNotes.slice(0, 8000) } : {}),
        isLocked: true,
        lockedAt: now,
      },
    });

    return {
      id: row.id,
      projectId: row.projectId,
      month: row.month,
      isLocked: row.isLocked,
      lockedAt: row.lockedAt?.toISOString() ?? null,
      agencyNotes: row.agencyNotes ?? '',
      shareToken: row.shareToken,
      shareExpiresAt: row.shareExpiresAt?.toISOString() ?? null,
      payload: row.payload as unknown as MonthlyReportPayload,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async createShareLink(
    organizationId: string,
    projectId: string,
    rawMonth: string,
    input?: { expiresInDays?: number | null; payload?: Partial<MonthlyReportPayload>; agencyNotes?: string },
  ) {
    const month = this.assertMonth(rawMonth);
    const existing = await this.getSnapshot(organizationId, projectId, month);

    if (!existing || !existing.isLocked || input?.payload) {
      await this.lockSnapshot(organizationId, projectId, month, {
        payload: input?.payload,
        agencyNotes: input?.agencyNotes ?? existing?.agencyNotes,
      });
    }

    const shareToken = existing?.shareToken || crypto.randomBytes(24).toString('base64url');
    const days = input?.expiresInDays === undefined ? 30 : input.expiresInDays;
    const shareExpiresAt =
      days && Number.isFinite(days) && days > 0
        ? new Date(Date.now() + Math.min(days, 365) * 24 * 60 * 60 * 1000)
        : null;

    const updated = await this.prisma.monthlyReportSnapshot.update({
      where: { projectId_month: { projectId, month } },
      data: { shareToken, shareExpiresAt },
    });

    return {
      month: updated.month,
      shareToken: updated.shareToken!,
      shareExpiresAt: updated.shareExpiresAt?.toISOString() ?? null,
      isLocked: updated.isLocked,
    };
  }

  async revokeShareLink(organizationId: string, projectId: string, rawMonth: string) {
    await this.assertProjectAccess(organizationId, projectId);
    const month = this.assertMonth(rawMonth);

    await this.prisma.monthlyReportSnapshot.updateMany({
      where: { projectId, organizationId, month },
      data: { shareToken: null, shareExpiresAt: null },
    });

    return { revoked: true, month };
  }

  /** Public read-only client portal lookup by cryptographic shareToken. */
  async getPublicSharedReport(shareToken: string) {
    const token = (shareToken ?? '').trim();
    if (!token || token.length < 16 || token.length > 128) {
      throw new NotFoundException('Shared report not found.');
    }

    const row = await this.prisma.monthlyReportSnapshot.findUnique({
      where: { shareToken: token },
    });
    if (!row) {
      throw new NotFoundException('Shared report not found or link was revoked.');
    }
    if (row.shareExpiresAt && row.shareExpiresAt.getTime() < Date.now()) {
      throw new GoneException('This shared report link has expired. Ask your agency for a fresh link.');
    }

    return {
      month: row.month,
      monthLabel: formatMonthLabel(row.month),
      lockedAt: row.lockedAt?.toISOString() ?? row.updatedAt.toISOString(),
      agencyNotes: row.agencyNotes ?? '',
      payload: row.payload as unknown as MonthlyReportPayload,
    };
  }

  /**
   * Renders a crisp A4 PDF buffer via headless Playwright Chromium.
   * Uses the frozen snapshot (or supplied payload merged with authoritative org white-label settings).
   */
  async renderPdfBuffer(
    organizationId: string,
    projectId: string,
    rawMonth: string,
    payloadOverride?: Partial<MonthlyReportPayload>,
    notesOverride?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const project = await this.assertProjectAccess(organizationId, projectId);
    const month = this.assertMonth(rawMonth);

    const existing = await this.prisma.monthlyReportSnapshot.findUnique({
      where: { projectId_month: { projectId, month } },
    });

    const basePayload = existing
      ? (existing.payload as unknown as MonthlyReportPayload)
      : await this.captureServerPayload(organizationId, projectId, month);

    const finalPayload: MonthlyReportPayload = {
      ...basePayload,
      ...(payloadOverride ?? {}),
      domain: project.websites[0]?.domain || project.name,
      month,
      monthLabel: formatMonthLabel(month),
      whiteLabel: this.buildWhiteLabel(project.organization),
    };
    const notes = notesOverride ?? existing?.agencyNotes ?? null;
    const html = renderMonthlyReportHtml(finalPayload, notes);

    const { chromium } = await import('playwright');
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdfBytes = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
      });
      const safeDomain = finalPayload.domain.replace(/[^a-z0-9.-]/gi, '-');
      return {
        buffer: Buffer.from(pdfBytes),
        filename: `${safeDomain}-monthly-report-${month}.pdf`,
      };
    } finally {
      await browser.close().catch(() => undefined);
    }
  }

  /** Builds a truthful server-side monthly snapshot from stored database telemetry. */
  async captureServerPayload(
    organizationId: string,
    projectId: string,
    month: string,
  ): Promise<MonthlyReportPayload> {
    const project = await this.assertProjectAccess(organizationId, projectId);
    const domain = project.websites[0]?.domain || project.name;
    const websiteId = project.websites[0]?.id;

    const [y, m] = month.split('-').map(Number);
    const monthStart = new Date(Date.UTC(y, m - 1, 1));
    const monthEnd = new Date(Date.UTC(y, m, 1));

    const [latestCrawl, ledgerEvents, topFindings, backlinkSources, compReport] = await Promise.all([
      websiteId && this.prisma.crawlJob?.findFirst
        ? this.prisma.crawlJob
            .findFirst({
              where: { websiteId, status: 'COMPLETED', finishedAt: { lt: monthEnd } },
              orderBy: { finishedAt: 'desc' },
              select: { healthScore: true, pagesCrawled: true, finishedAt: true },
            })
            .catch(() => null)
        : Promise.resolve(null),
      this.prisma.fixImpactLedgerEvent?.findMany
        ? this.prisma.fixImpactLedgerEvent
            .findMany({
              where: { projectId, createdAt: { gte: monthStart, lt: monthEnd } },
              orderBy: { createdAt: 'desc' },
              take: 50,
            })
            .catch(() => [] as any[])
        : Promise.resolve([] as any[]),
      this.prisma.growthOpportunity?.findMany
        ? this.prisma.growthOpportunity
            .findMany({
              where: { projectId, status: 'OPEN' },
              orderBy: [{ priority: 'desc' }, { impact: 'desc' }],
              take: 5,
              select: { title: true, source: true, potential: true, effort: true, evidence: true },
            })
            .catch(() => [] as any[])
        : Promise.resolve([] as any[]),
      this.prisma.backlinkSource?.findMany
        ? this.prisma.backlinkSource
            .findMany({
              where: { projectId },
              orderBy: { createdAt: 'desc' },
              take: 200,
              select: { sourceUrl: true, status: true, createdAt: true },
            })
            .catch(() => [] as Array<{ sourceUrl: string; status: string; createdAt: Date }>)
        : Promise.resolve([] as Array<{ sourceUrl: string; status: string; createdAt: Date }>),
      this.prisma.competitorReportSnapshot?.findFirst
        ? this.prisma.competitorReportSnapshot
            .findFirst({
              where: { projectId, createdAt: { lt: monthEnd } },
              orderBy: { createdAt: 'desc' },
              select: { report: true },
            })
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    const verifiedEvents = ledgerEvents.filter(
      (e) => e.eventType === 'DEPLOYMENT_VERIFIED' || e.eventType === 'TECHNICAL_FIX_CONFIRMED',
    );
    const regressions = ledgerEvents.filter((e) => e.eventType === 'REGRESSION_DETECTED');
    const rollbacks = ledgerEvents.filter((e) => e.eventType === 'FIX_ROLLED_BACK');
    const confirmedWins = ledgerEvents.filter((e) => e.eventType === 'IMPACT_CONFIRMED');

    const verifiedLinks = backlinkSources.filter((b) => b.status === 'LIVE' || b.status === 'VERIFIED');
    const refDomains = new Set(verifiedLinks.map((b) => hostOfUrl(b.sourceUrl)).filter(Boolean));
    const newLinks = backlinkSources.filter(
      (b) => b.createdAt && b.createdAt >= monthStart && b.createdAt < monthEnd,
    );
    const lostLinks = backlinkSources.filter((b) => b.status === 'LOST' || b.status === 'REMOVED');

    const nextMonthPriorities = topFindings.map((f) => {
      const ev = Array.isArray(f.evidence) ? (f.evidence as Array<{ label?: string; value?: string }>) : [];
      const roi = ev.find((e) => e?.label === 'Site historical ROI')?.value ?? null;
      return {
        title: f.title,
        source: f.source,
        potential: f.potential,
        effort: f.effort,
        roiNote: roi,
      };
    });

    const wins: string[] = [];
    for (const w of confirmedWins.slice(0, 3)) wins.push(w.title);
    if (newLinks.length > 0) wins.push(`${newLinks.length} new backlink source${newLinks.length === 1 ? '' : 's'} discovered this month.`);
    if (latestCrawl?.healthScore != null) wins.push(`Website technical health measured at ${latestCrawl.healthScore}/100 across ${latestCrawl.pagesCrawled} crawled pages.`);

    const workCompleted: string[] = [];
    if (verifiedEvents.length > 0) {
      workCompleted.push(`${verifiedEvents.length} website optimization${verifiedEvents.length === 1 ? '' : 's'} deployed and verified live.`);
    }
    if (regressions.length > 0) {
      workCompleted.push(`Regression Guard automatically detected and reopened ${regressions.length} recurring issue${regressions.length === 1 ? '' : 's'}.`);
    }
    if (rollbacks.length > 0) {
      workCompleted.push(`${rollbacks.length} change${rollbacks.length === 1 ? '' : 's'} safely rolled back via 1-click rollback.`);
    }

    const compData = (compReport?.report ?? null) as Record<string, any> | null;

    return {
      domain,
      month,
      monthLabel: formatMonthLabel(month),
      generatedAt: new Date().toISOString(),
      whiteLabel: this.buildWhiteLabel(project.organization),
      executiveSummary: {
        wins,
        workCompleted,
        nextMonthFocus: nextMonthPriorities.slice(0, 3).map((p) => p.title),
      },
      kpis: {
        healthScore: latestCrawl?.healthScore ?? null,
        pagesCrawled: latestCrawl?.pagesCrawled ?? null,
        verifiedFixes: verifiedEvents.length,
        rollbacks: rollbacks.length,
        regressions: regressions.length,
        referringDomains: refDomains.size,
        verifiedBacklinks: verifiedLinks.length,
      },
      backlinks:
        backlinkSources.length > 0
          ? {
              totalVerified: verifiedLinks.length,
              referringDomains: refDomains.size,
              newCount: newLinks.length,
              lostCount: lostLinks.length,
              topSources: verifiedLinks.slice(0, 10).map((s) => ({
                domain: hostOfUrl(s.sourceUrl),
                url: s.sourceUrl,
                status: s.status,
              })),
            }
          : null,
      competitors: compData
        ? {
            summary: compData.analysis?.executiveSummary ?? null,
            rivals: [],
          }
        : null,
      fixes: verifiedEvents.map((e) => ({
        title: e.title,
        url: e.affectedUrl ?? '',
        field: String(((e.evidenceData as Record<string, unknown>) ?? {}).field ?? 'SEO'),
        status: e.verificationStatus ?? 'VERIFIED',
        verifiedAt: e.createdAt.toISOString(),
        pullRequestUrl: e.pullRequestUrl,
      })),
      accountabilityEvents: [...regressions, ...rollbacks].map((e) => ({
        eventType: e.eventType,
        title: e.title,
        affectedUrl: e.affectedUrl,
        createdAt: e.createdAt.toISOString(),
      })),
      nextMonthPriorities,
    };
  }

  /**
   * 1st-of-month automatic snapshot freeze (6:00 AM UTC).
   * Locks the just-completed calendar month for every active project so historical
   * monthly reports never drift when reopened months later.
   */
  @Cron('0 6 1 * *')
  async autoFreezeCompletedMonth(): Promise<{ frozen: number }> {
    if (!scheduledJobsEnabled()) return { frozen: 0 };
    const month = previousMonthKey();
    const projects = await this.prisma.project.findMany({
      where: { websites: { some: {} } },
      select: { id: true, organizationId: true },
      take: 500,
    });

    let frozen = 0;
    for (const p of projects) {
      try {
        const existing = await this.prisma.monthlyReportSnapshot.findUnique({
          where: { projectId_month: { projectId: p.id, month } },
          select: { isLocked: true },
        });
        if (existing?.isLocked) continue;
        await this.lockSnapshot(p.organizationId, p.id, month);
        frozen++;
      } catch (err) {
        this.logger.warn(`[${p.id}] Auto-freeze monthly report (${month}) failed: ${(err as Error).message}`);
      }
    }
    this.logger.log(`Auto-froze ${frozen} monthly report snapshot(s) for ${month}.`);
    return { frozen };
  }
}
