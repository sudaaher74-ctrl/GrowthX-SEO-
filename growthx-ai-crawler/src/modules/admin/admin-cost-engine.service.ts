import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TokensService } from '../tokens/tokens.service';
import { readTokenConfig } from '../tokens/token-rates';
import { UpdateAdminCostRatesDto } from './admin.dto';

export type CostWindow = '24h' | '7d' | 'mtd' | '30d' | 'all';

export type ProfitabilityStatus =
  | 'PROFITABLE'
  | 'WATCH'
  | 'LOSS_MAKING'
  | 'FREE_HIGH_BURN'
  | 'IDLE';

export interface AdminCostRates {
  usdToInr: number;
  staticPageCostUsd: number;
  renderedPageCostUsd: number;
  geoGridPointCostUsd: number;
  serpFallbackCostUsd: number;
  keywordGapFallbackCostUsd: number;
  backlinkRunCostUsd: number;
  freeHighBurnThresholdUsd: number;
  tierMrrUsd: {
    founder_free: number;
    starter: number;
    growth: number;
    agency: number;
  };
  updatedAt: string;
}

export interface CostBucketsUsd {
  aiRouterUsd: number;
  aiVisibilityUsd: number;
  crawlerComputeUsd: number;
  geoGridUsd: number;
  externalApisUsd: number;
  totalUsd: number;
  totalInr: number;
}

/** Fallback per-1M-token USD rates used only when AiUsageRecord.estimatedCostUsd is null. */
const FALLBACK_MODEL_RATES: Array<{ match: RegExp; inputPerM: number; outputPerM: number }> = [
  { match: /gemini[-_]?2\.5[-_]?flash[-_]?lite/i, inputPerM: 0.075, outputPerM: 0.3 },
  { match: /gemini[-_]?2\.5[-_]?flash|gemini[-_]?2\.0[-_]?flash/i, inputPerM: 0.15, outputPerM: 0.6 },
  { match: /gemini[-_]?2\.5[-_]?pro|gemini[-_]?1\.5[-_]?pro/i, inputPerM: 1.25, outputPerM: 5.0 },
  { match: /gpt[-_]?4o[-_]?mini/i, inputPerM: 0.15, outputPerM: 0.6 },
  { match: /gpt[-_]?4o|gpt[-_]?4\.1/i, inputPerM: 2.5, outputPerM: 10.0 },
  { match: /claude[-_]?3\.5[-_]?haiku|claude[-_]?haiku/i, inputPerM: 0.8, outputPerM: 4.0 },
  { match: /claude[-_]?3\.5[-_]?sonnet|claude[-_]?3\.7|claude[-_]?sonnet/i, inputPerM: 3.0, outputPerM: 15.0 },
  { match: /sonar[-_]?pro/i, inputPerM: 3.0, outputPerM: 15.0 },
  { match: /sonar|perplexity/i, inputPerM: 1.0, outputPerM: 1.0 },
  { match: /llama[-_]?3|groq|mixtral/i, inputPerM: 0.2, outputPerM: 0.6 },
  { match: /sarvam/i, inputPerM: 0.35, outputPerM: 1.0 },
];

export function estimateModelCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
  recordedCostUsd: number | null | undefined,
): { costUsd: number; priced: boolean } {
  if (typeof recordedCostUsd === 'number' && Number.isFinite(recordedCostUsd) && recordedCostUsd >= 0) {
    return { costUsd: recordedCostUsd, priced: true };
  }
  const hit = FALLBACK_MODEL_RATES.find((r) => r.match.test(model || ''));
  if (!hit) return { costUsd: 0, priced: false };
  const cost = (Math.max(0, inputTokens) / 1_000_000) * hit.inputPerM + (Math.max(0, outputTokens) / 1_000_000) * hit.outputPerM;
  return { costUsd: Number(cost.toFixed(6)), priced: true };
}

export function resolveWindowStart(window: string | undefined, now = new Date()): { window: CostWindow; since: Date | null; daysInWindow: number } {
  const normalized = (window || '30d').toLowerCase();
  if (normalized === '24h') {
    return { window: '24h', since: new Date(now.getTime() - 24 * 60 * 60 * 1000), daysInWindow: 1 };
  }
  if (normalized === '7d') {
    return { window: '7d', since: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), daysInWindow: 7 };
  }
  if (normalized === 'mtd') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const elapsedDays = Math.max(1, (now.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    return { window: 'mtd', since: start, daysInWindow: elapsedDays };
  }
  if (normalized === 'all') {
    return { window: 'all', since: null, daysInWindow: 30 };
  }
  return { window: '30d', since: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), daysInWindow: 30 };
}

export function classifyProfitability(params: {
  tier: string;
  mrrUsd: number;
  projectedMonthlyUsd: number;
  totalUsd: number;
  freeHighBurnThresholdUsd: number;
}): { status: ProfitabilityStatus; netMarginUsd: number; marginPct: number | null } {
  const { tier, mrrUsd, projectedMonthlyUsd, totalUsd, freeHighBurnThresholdUsd } = params;
  const netMarginUsd = Number((mrrUsd - projectedMonthlyUsd).toFixed(4));

  if (totalUsd <= 0.0001 && mrrUsd <= 0) {
    return { status: 'IDLE', netMarginUsd: 0, marginPct: null };
  }

  if (tier === 'founder_free' || mrrUsd <= 0) {
    const status: ProfitabilityStatus =
      totalUsd >= freeHighBurnThresholdUsd || projectedMonthlyUsd >= freeHighBurnThresholdUsd
        ? 'FREE_HIGH_BURN'
        : 'IDLE';
    return { status, netMarginUsd, marginPct: null };
  }

  const marginPct = Number((((mrrUsd - projectedMonthlyUsd) / mrrUsd) * 100).toFixed(1));
  if (projectedMonthlyUsd > mrrUsd) {
    return { status: 'LOSS_MAKING', netMarginUsd, marginPct };
  }
  if (marginPct < 60) {
    return { status: 'WATCH', netMarginUsd, marginPct };
  }
  return { status: 'PROFITABLE', netMarginUsd, marginPct };
}

function roundUsd(n: number): number {
  return Number((Number.isFinite(n) ? n : 0).toFixed(4));
}

function roundInr(usd: number, fx: number): number {
  return Number(((Number.isFinite(usd) ? usd : 0) * fx).toFixed(2));
}

function parseEnvNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

@Injectable()
export class AdminCostEngineService {
  private rates: AdminCostRates;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
  ) {
    this.rates = {
      usdToInr: parseEnvNumber('ADMIN_USD_TO_INR', 85),
      staticPageCostUsd: parseEnvNumber('ADMIN_COST_STATIC_PAGE_USD', 0.0001),
      renderedPageCostUsd: parseEnvNumber('ADMIN_COST_RENDERED_PAGE_USD', 0.0015),
      geoGridPointCostUsd: parseEnvNumber('ADMIN_COST_GEO_GRID_POINT_USD', 0.032),
      serpFallbackCostUsd: parseEnvNumber('ADMIN_COST_SERP_FALLBACK_USD', 0.002),
      keywordGapFallbackCostUsd: parseEnvNumber('ADMIN_COST_KEYWORD_GAP_USD', 0.005),
      backlinkRunCostUsd: parseEnvNumber('ADMIN_COST_BACKLINK_RUN_USD', 0.015),
      freeHighBurnThresholdUsd: parseEnvNumber('ADMIN_FREE_HIGH_BURN_USD', 2.0),
      tierMrrUsd: {
        founder_free: 0,
        starter: parseEnvNumber('ADMIN_MRR_STARTER_USD', 49),
        growth: parseEnvNumber('ADMIN_MRR_GROWTH_USD', 149),
        agency: parseEnvNumber('ADMIN_MRR_AGENCY_USD', 399),
      },
      updatedAt: new Date().toISOString(),
    };
  }

  getRates(): AdminCostRates {
    return {
      ...this.rates,
      tierMrrUsd: { ...this.rates.tierMrrUsd },
    };
  }

  async updateRates(patch: UpdateAdminCostRatesDto, actorUserId?: string): Promise<AdminCostRates> {
    if (patch.usdToInr !== undefined) this.rates.usdToInr = patch.usdToInr;
    if (patch.staticPageCostUsd !== undefined) this.rates.staticPageCostUsd = patch.staticPageCostUsd;
    if (patch.renderedPageCostUsd !== undefined) this.rates.renderedPageCostUsd = patch.renderedPageCostUsd;
    if (patch.geoGridPointCostUsd !== undefined) this.rates.geoGridPointCostUsd = patch.geoGridPointCostUsd;
    if (patch.serpFallbackCostUsd !== undefined) this.rates.serpFallbackCostUsd = patch.serpFallbackCostUsd;
    if (patch.keywordGapFallbackCostUsd !== undefined) this.rates.keywordGapFallbackCostUsd = patch.keywordGapFallbackCostUsd;
    if (patch.backlinkRunCostUsd !== undefined) this.rates.backlinkRunCostUsd = patch.backlinkRunCostUsd;
    if (patch.freeHighBurnThresholdUsd !== undefined) this.rates.freeHighBurnThresholdUsd = patch.freeHighBurnThresholdUsd;
    if (patch.starterMrrUsd !== undefined) this.rates.tierMrrUsd.starter = patch.starterMrrUsd;
    if (patch.growthMrrUsd !== undefined) this.rates.tierMrrUsd.growth = patch.growthMrrUsd;
    if (patch.agencyMrrUsd !== undefined) this.rates.tierMrrUsd.agency = patch.agencyMrrUsd;
    this.rates.updatedAt = new Date().toISOString();

    if (actorUserId && this.prisma.auditLog?.create && this.prisma.organizationMember?.findFirst) {
      const membership = await this.prisma.organizationMember
        .findFirst({ where: { userId: actorUserId }, select: { organizationId: true } })
        .catch(() => null);
      if (membership?.organizationId) {
        await this.prisma.auditLog
          .create({
            data: {
              organizationId: membership.organizationId,
              userId: actorUserId,
              action: 'ADMIN_COST_RATES_UPDATED',
              resource: 'AdminCostRates',
              details: patch as any,
            },
          })
          .catch(() => undefined);
      }
    }

    return this.getRates();
  }

  private tierMrr(tier: string): number {
    const key = (tier || 'founder_free') as keyof AdminCostRates['tierMrrUsd'];
    return this.rates.tierMrrUsd[key] ?? 0;
  }

  private resolveWebsiteProjectId(website: { projectId: string | null; scope?: string | null }): string | null {
    if (website.projectId) return website.projectId;
    const scope = website.scope || '';
    if (scope.startsWith('competitor:')) return scope.slice('competitor:'.length) || null;
    return null;
  }

  /**
   * Computes complete platform-wide User 360° intelligence & automated 5-bucket COGS
   * across every user without double-counting multi-member workspaces.
   */
  async getUsersIntelligence(windowInput?: string) {
    const now = new Date();
    const { window, since, daysInWindow } = resolveWindowStart(windowInput, now);
    const createdAtFilter = since ? { gte: since } : undefined;
    const tokenConfig = readTokenConfig();

    const [
      users,
      orgs,
      projects,
      websites,
      wallets,
      crawlJobs,
      renderedPagesByJob,
      aiUsageRows,
      aiVisRows,
      tokenTxRows,
      geoGridRows,
      serpRows,
      kwGapRows,
      backlinkRows,
      fixRows,
      reportRows,
      voiceRows,
    ] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          emailVerifiedAt: true,
          googleSub: true,
          passwordAuthEnabled: true,
          isPlatformAdmin: true,
          platformAdminRevokedAt: true,
          createdAt: true,
          memberships: {
            select: { organizationId: true, role: true },
          },
          sessions: {
            where: { revokedAt: null, expiresAt: { gt: now } },
            select: { id: true, createdAt: true },
          },
        },
      }),
      this.prisma.organization.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          subscriptionTier: true,
          aiMonthlyBudgetUsd: true,
          whiteLabelEnabled: true,
          createdAt: true,
          members: { select: { userId: true, role: true } },
        },
      }),
      this.prisma.project.findMany({
        select: { id: true, name: true, organizationId: true },
      }),
      this.prisma.website.findMany({
        select: { id: true, domain: true, projectId: true, scope: true, isVerified: true },
      }),
      this.prisma.tokenWallet?.findMany
        ? this.prisma.tokenWallet.findMany().catch(() => [])
        : Promise.resolve([]),
      this.prisma.crawlJob?.findMany
        ? this.prisma.crawlJob
            .findMany({
              where: createdAtFilter ? { createdAt: createdAtFilter } : undefined,
              select: {
                id: true,
                websiteId: true,
                status: true,
                pagesCrawled: true,
                issuesFound: true,
                createdAt: true,
              },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.page?.groupBy
        ? this.prisma.page
            .groupBy({
              by: ['crawlJobId'],
              where: {
                jsRequired: true,
                ...(createdAtFilter ? { crawledAt: createdAtFilter } : {}),
              },
              _count: { _all: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.aiUsageRecord?.findMany
        ? this.prisma.aiUsageRecord
            .findMany({
              where: createdAtFilter ? { createdAt: createdAtFilter } : undefined,
              select: {
                organizationId: true,
                projectId: true,
                taskType: true,
                provider: true,
                model: true,
                inputTokens: true,
                outputTokens: true,
                estimatedCostUsd: true,
                status: true,
                createdAt: true,
              },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.aiVisibilityProviderUsage?.findMany
        ? this.prisma.aiVisibilityProviderUsage
            .findMany({
              where: createdAtFilter ? { createdAt: createdAtFilter } : undefined,
              select: {
                projectId: true,
                provider: true,
                model: true,
                inputTokens: true,
                outputTokens: true,
                cost: true,
                createdAt: true,
              },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.tokenTransaction?.findMany
        ? this.prisma.tokenTransaction
            .findMany({
              where: {
                kind: { in: ['SPEND', 'REFUND'] },
                ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
              },
              select: {
                organizationId: true,
                userId: true,
                kind: true,
                action: true,
                allowanceDelta: true,
                bonusDelta: true,
                shortfall: true,
                createdAt: true,
              },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.geoGridRun?.findMany
        ? this.prisma.geoGridRun
            .findMany({
              where: createdAtFilter ? { ranAt: createdAtFilter } : undefined,
              select: { projectId: true, gridSize: true, ranAt: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.serpSnapshot?.findMany
        ? this.prisma.serpSnapshot
            .findMany({
              where: createdAtFilter ? { checkedAt: createdAtFilter } : undefined,
              select: { projectId: true, costUsd: true, checkedAt: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.keywordGapSnapshot?.findMany
        ? this.prisma.keywordGapSnapshot
            .findMany({
              where: createdAtFilter ? { fetchedAt: createdAtFilter } : undefined,
              select: { projectId: true, costUsd: true, fetchedAt: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.backlinkDiscoveryRun?.findMany
        ? this.prisma.backlinkDiscoveryRun
            .findMany({
              where: createdAtFilter ? { startedAt: createdAtFilter } : undefined,
              select: { projectId: true, startedAt: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.fixIntervention?.groupBy
        ? this.prisma.fixIntervention
            .groupBy({
              by: ['projectId'],
              where: createdAtFilter ? { createdAt: createdAtFilter } : undefined,
              _count: { _all: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.auditReportSnapshot?.groupBy
        ? this.prisma.auditReportSnapshot
            .groupBy({
              by: ['projectId'],
              where: createdAtFilter ? { createdAt: createdAtFilter } : undefined,
              _count: { _all: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
      this.prisma.voiceSession?.groupBy
        ? this.prisma.voiceSession
            .groupBy({
              by: ['orgId'],
              where: createdAtFilter ? { createdAt: createdAtFilter } : undefined,
              _count: { _all: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    // Build lookup maps: project -> org, website -> org, crawlJob -> rendered pages
    const projectToOrg = new Map<string, string>();
    const orgProjectCounts = new Map<string, number>();
    for (const p of projects) {
      projectToOrg.set(p.id, p.organizationId);
      orgProjectCounts.set(p.organizationId, (orgProjectCounts.get(p.organizationId) ?? 0) + 1);
    }

    const websiteToOrg = new Map<string, string>();
    const orgWebsiteCounts = new Map<string, number>();
    for (const w of websites) {
      const pid = this.resolveWebsiteProjectId(w);
      if (!pid) continue;
      const oid = projectToOrg.get(pid);
      if (!oid) continue;
      websiteToOrg.set(w.id, oid);
      if (w.scope === 'own' || w.projectId) {
        orgWebsiteCounts.set(oid, (orgWebsiteCounts.get(oid) ?? 0) + 1);
      }
    }

    const renderedByJob = new Map<string, number>();
    for (const row of renderedPagesByJob as any[]) {
      renderedByJob.set(row.crawlJobId, row._count?._all ?? 0);
    }

    const walletByOrg = new Map<string, any>();
    for (const w of wallets as any[]) {
      walletByOrg.set(w.organizationId, w);
    }

    // Per-org accumulator
    interface OrgAcc {
      orgId: string;
      name: string;
      tier: string;
      aiMonthlyBudgetUsd: number | null;
      memberCount: number;
      ownerUserId: string | null;
      aiRouterUsd: number;
      aiRouterCalls: number;
      aiRouterErrors: number;
      aiInputTokens: number;
      aiOutputTokens: number;
      unpricedAiCalls: number;
      models: Map<string, number>;
      aiVisibilityUsd: number;
      aiVisibilityScans: number;
      crawlsTotal: number;
      crawlsFailed: number;
      pagesCrawled: number;
      pagesRendered: number;
      geoGridRuns: number;
      geoGridPoints: number;
      serpChecks: number;
      serpCostUsd: number;
      kwGapChecks: number;
      kwGapCostUsd: number;
      backlinkRuns: number;
      fixesCount: number;
      reportsCount: number;
      voiceSessions: number;
      tokensSpent: number;
      tokensShortfall: number;
      lastActivityAt: Date | null;
    }

    const orgAccMap = new Map<string, OrgAcc>();
    for (const o of orgs) {
      const owner = o.members.find((m) => m.role === 'OWNER') ?? o.members[0];
      orgAccMap.set(o.id, {
        orgId: o.id,
        name: o.name,
        tier: o.subscriptionTier || 'founder_free',
        aiMonthlyBudgetUsd: o.aiMonthlyBudgetUsd ?? null,
        memberCount: Math.max(1, o.members.length),
        ownerUserId: owner?.userId ?? null,
        aiRouterUsd: 0,
        aiRouterCalls: 0,
        aiRouterErrors: 0,
        aiInputTokens: 0,
        aiOutputTokens: 0,
        unpricedAiCalls: 0,
        models: new Map(),
        aiVisibilityUsd: 0,
        aiVisibilityScans: 0,
        crawlsTotal: 0,
        crawlsFailed: 0,
        pagesCrawled: 0,
        pagesRendered: 0,
        geoGridRuns: 0,
        geoGridPoints: 0,
        serpChecks: 0,
        serpCostUsd: 0,
        kwGapChecks: 0,
        kwGapCostUsd: 0,
        backlinkRuns: 0,
        fixesCount: 0,
        reportsCount: 0,
        voiceSessions: 0,
        tokensSpent: 0,
        tokensShortfall: 0,
        lastActivityAt: null,
      });
    }

    const touchActivity = (acc: OrgAcc, d: Date | null | undefined) => {
      if (!d) return;
      if (!acc.lastActivityAt || d > acc.lastActivityAt) acc.lastActivityAt = d;
    };

    // 1. Crawl jobs & static/rendered pages
    for (const c of crawlJobs as any[]) {
      const oid = websiteToOrg.get(c.websiteId);
      const acc = oid ? orgAccMap.get(oid) : undefined;
      if (!acc) continue;
      acc.crawlsTotal += 1;
      if (c.status === 'FAILED') acc.crawlsFailed += 1;
      const pages = Math.max(0, c.pagesCrawled || 0);
      const rendered = Math.min(pages, renderedByJob.get(c.id) ?? 0);
      acc.pagesCrawled += pages;
      acc.pagesRendered += rendered;
      touchActivity(acc, c.createdAt);
    }

    // 2. Core AI Router usage
    for (const row of aiUsageRows as any[]) {
      const oid = row.organizationId || (row.projectId ? projectToOrg.get(row.projectId) : undefined);
      const acc = oid ? orgAccMap.get(oid) : undefined;
      if (!acc) continue;
      const est = estimateModelCostUsd(row.model, row.inputTokens || 0, row.outputTokens || 0, row.estimatedCostUsd);
      acc.aiRouterUsd += est.costUsd;
      if (!est.priced) acc.unpricedAiCalls += 1;
      acc.aiRouterCalls += 1;
      if (row.status !== 'OK') acc.aiRouterErrors += 1;
      acc.aiInputTokens += row.inputTokens || 0;
      acc.aiOutputTokens += row.outputTokens || 0;
      if (row.model) acc.models.set(row.model, (acc.models.get(row.model) ?? 0) + 1);
      touchActivity(acc, row.createdAt);
    }

    // 3. AI Visibility scans
    for (const row of aiVisRows as any[]) {
      const oid = projectToOrg.get(row.projectId);
      const acc = oid ? orgAccMap.get(oid) : undefined;
      if (!acc) continue;
      acc.aiVisibilityUsd += Number(row.cost || 0);
      acc.aiVisibilityScans += 1;
      acc.aiInputTokens += row.inputTokens || 0;
      acc.aiOutputTokens += row.outputTokens || 0;
      if (row.model) acc.models.set(row.model, (acc.models.get(row.model) ?? 0) + 1);
      touchActivity(acc, row.createdAt);
    }

    // 4. Token ledger spend (org-wide + direct user attribution)
    const userDirectTokens = new Map<string, number>();
    for (const tx of tokenTxRows as any[]) {
      const delta = -(Number(tx.allowanceDelta || 0) + Number(tx.bonusDelta || 0));
      const acc = orgAccMap.get(tx.organizationId);
      if (acc) {
        acc.tokensSpent += delta;
        acc.tokensShortfall += Number(tx.shortfall || 0);
        touchActivity(acc, tx.createdAt);
      }
      if (tx.userId) {
        userDirectTokens.set(tx.userId, (userDirectTokens.get(tx.userId) ?? 0) + delta);
      }
    }

    // 5. Geo-Grid runs (Google Places)
    for (const g of geoGridRows as any[]) {
      const oid = projectToOrg.get(g.projectId);
      const acc = oid ? orgAccMap.get(oid) : undefined;
      if (!acc) continue;
      const size = Math.max(1, g.gridSize || 3);
      acc.geoGridRuns += 1;
      acc.geoGridPoints += size * size;
      touchActivity(acc, g.ranAt);
    }

    // 6. External SEO APIs (SERP, Keyword Gap, Backlinks)
    for (const s of serpRows as any[]) {
      const oid = projectToOrg.get(s.projectId);
      const acc = oid ? orgAccMap.get(oid) : undefined;
      if (!acc) continue;
      acc.serpChecks += 1;
      acc.serpCostUsd += typeof s.costUsd === 'number' && s.costUsd >= 0 ? s.costUsd : this.rates.serpFallbackCostUsd;
      touchActivity(acc, s.checkedAt);
    }
    for (const k of kwGapRows as any[]) {
      const oid = projectToOrg.get(k.projectId);
      const acc = oid ? orgAccMap.get(oid) : undefined;
      if (!acc) continue;
      acc.kwGapChecks += 1;
      acc.kwGapCostUsd += typeof k.costUsd === 'number' && k.costUsd >= 0 ? k.costUsd : this.rates.keywordGapFallbackCostUsd;
      touchActivity(acc, k.fetchedAt);
    }
    for (const b of backlinkRows as any[]) {
      const oid = projectToOrg.get(b.projectId);
      const acc = oid ? orgAccMap.get(oid) : undefined;
      if (!acc) continue;
      acc.backlinkRuns += 1;
      touchActivity(acc, b.startedAt);
    }

    // 7. Module counts
    for (const f of fixRows as any[]) {
      const oid = projectToOrg.get(f.projectId);
      const acc = oid ? orgAccMap.get(oid) : undefined;
      if (acc) acc.fixesCount += f._count?._all ?? 0;
    }
    for (const r of reportRows as any[]) {
      const oid = projectToOrg.get(r.projectId);
      const acc = oid ? orgAccMap.get(oid) : undefined;
      if (acc) acc.reportsCount += r._count?._all ?? 0;
    }
    for (const v of voiceRows as any[]) {
      const acc = orgAccMap.get(v.orgId);
      if (acc) acc.voiceSessions += v._count?._all ?? 0;
    }

    const computeOrgBuckets = (acc: OrgAcc): CostBucketsUsd => {
      const staticPages = Math.max(0, acc.pagesCrawled - acc.pagesRendered);
      const crawlerComputeUsd =
        staticPages * this.rates.staticPageCostUsd + acc.pagesRendered * this.rates.renderedPageCostUsd;
      const geoGridUsd = acc.geoGridPoints * this.rates.geoGridPointCostUsd;
      const externalApisUsd =
        acc.serpCostUsd + acc.kwGapCostUsd + acc.backlinkRuns * this.rates.backlinkRunCostUsd;
      const totalUsd = acc.aiRouterUsd + acc.aiVisibilityUsd + crawlerComputeUsd + geoGridUsd + externalApisUsd;
      return {
        aiRouterUsd: roundUsd(acc.aiRouterUsd),
        aiVisibilityUsd: roundUsd(acc.aiVisibilityUsd),
        crawlerComputeUsd: roundUsd(crawlerComputeUsd),
        geoGridUsd: roundUsd(geoGridUsd),
        externalApisUsd: roundUsd(externalApisUsd),
        totalUsd: roundUsd(totalUsd),
        totalInr: roundInr(totalUsd, this.rates.usdToInr),
      };
    };

    // Platform totals computed ONCE across organizations so multi-member orgs are NEVER double-counted
    const platformBuckets: CostBucketsUsd = {
      aiRouterUsd: 0,
      aiVisibilityUsd: 0,
      crawlerComputeUsd: 0,
      geoGridUsd: 0,
      externalApisUsd: 0,
      totalUsd: 0,
      totalInr: 0,
    };
    let platformMrrUsd = 0;
    let platformTokensSpent = 0;
    let platformCrawls = 0;
    let platformPagesCrawled = 0;
    let platformRenderedPages = 0;
    let platformAiCalls = 0;
    let platformAiTokens = 0;

    const orgBucketsMap = new Map<string, CostBucketsUsd>();
    for (const acc of orgAccMap.values()) {
      const b = computeOrgBuckets(acc);
      orgBucketsMap.set(acc.orgId, b);
      platformBuckets.aiRouterUsd += b.aiRouterUsd;
      platformBuckets.aiVisibilityUsd += b.aiVisibilityUsd;
      platformBuckets.crawlerComputeUsd += b.crawlerComputeUsd;
      platformBuckets.geoGridUsd += b.geoGridUsd;
      platformBuckets.externalApisUsd += b.externalApisUsd;
      platformBuckets.totalUsd += b.totalUsd;
      platformMrrUsd += this.tierMrr(acc.tier);
      platformTokensSpent += Math.max(0, acc.tokensSpent);
      platformCrawls += acc.crawlsTotal;
      platformPagesCrawled += acc.pagesCrawled;
      platformRenderedPages += acc.pagesRendered;
      platformAiCalls += acc.aiRouterCalls + acc.aiVisibilityScans;
      platformAiTokens += acc.aiInputTokens + acc.aiOutputTokens;
    }
    platformBuckets.aiRouterUsd = roundUsd(platformBuckets.aiRouterUsd);
    platformBuckets.aiVisibilityUsd = roundUsd(platformBuckets.aiVisibilityUsd);
    platformBuckets.crawlerComputeUsd = roundUsd(platformBuckets.crawlerComputeUsd);
    platformBuckets.geoGridUsd = roundUsd(platformBuckets.geoGridUsd);
    platformBuckets.externalApisUsd = roundUsd(platformBuckets.externalApisUsd);
    platformBuckets.totalUsd = roundUsd(platformBuckets.totalUsd);
    platformBuckets.totalInr = roundInr(platformBuckets.totalUsd, this.rates.usdToInr);

    let activeUsers = 0;
    let freeHighBurnUsers = 0;
    let lossMakingUsers = 0;

    const userRows = users.map((u) => {
      const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim() || u.email.split('@')[0];
      const primaryMembership =
        u.memberships.find((m) => m.role === 'OWNER') ?? u.memberships[0] ?? null;
      const primaryOrg = primaryMembership ? orgAccMap.get(primaryMembership.organizationId) ?? null : null;

      // Aggregate across workspaces this user owns (or their primary workspace if they own none)
      const ownedOrgIds = u.memberships
        .filter((m) => m.role === 'OWNER')
        .map((m) => m.organizationId);
      const attributedOrgIds =
        ownedOrgIds.length > 0
          ? ownedOrgIds
          : primaryMembership
            ? [primaryMembership.organizationId]
            : [];

      const buckets: CostBucketsUsd = {
        aiRouterUsd: 0,
        aiVisibilityUsd: 0,
        crawlerComputeUsd: 0,
        geoGridUsd: 0,
        externalApisUsd: 0,
        totalUsd: 0,
        totalInr: 0,
      };
      let crawlsTotal = 0;
      let crawlsFailed = 0;
      let pagesCrawled = 0;
      let pagesRendered = 0;
      let aiCalls = 0;
      let aiErrors = 0;
      let aiTokens = 0;
      let unpricedAiCalls = 0;
      let geoGridPoints = 0;
      let externalApiCalls = 0;
      let tokensSpent = 0;
      let tokensAvailable = 0;
      let tokensMonthly = 0;
      let tokensBonus = 0;
      let tokensShortfall = 0;
      let projectsCount = 0;
      let websitesCount = 0;
      let mrrUsd = 0;
      let isSharedWorkspace = false;
      let lastActivityAt: Date | null = null;
      const modelCounts = new Map<string, number>();

      for (const oid of attributedOrgIds) {
        const acc = orgAccMap.get(oid);
        const b = orgBucketsMap.get(oid);
        if (!acc || !b) continue;
        // Share attribution cleanly when a user is not the sole member/owner
        const shareFactor =
          ownedOrgIds.length > 0 && acc.ownerUserId === u.id
            ? 1
            : acc.memberCount > 1
              ? 1 / acc.memberCount
              : 1;
        if (acc.memberCount > 1) isSharedWorkspace = true;

        buckets.aiRouterUsd += b.aiRouterUsd * shareFactor;
        buckets.aiVisibilityUsd += b.aiVisibilityUsd * shareFactor;
        buckets.crawlerComputeUsd += b.crawlerComputeUsd * shareFactor;
        buckets.geoGridUsd += b.geoGridUsd * shareFactor;
        buckets.externalApisUsd += b.externalApisUsd * shareFactor;
        buckets.totalUsd += b.totalUsd * shareFactor;

        crawlsTotal += acc.crawlsTotal;
        crawlsFailed += acc.crawlsFailed;
        pagesCrawled += acc.pagesCrawled;
        pagesRendered += acc.pagesRendered;
        aiCalls += acc.aiRouterCalls + acc.aiVisibilityScans;
        aiErrors += acc.aiRouterErrors;
        aiTokens += acc.aiInputTokens + acc.aiOutputTokens;
        unpricedAiCalls += acc.unpricedAiCalls;
        geoGridPoints += acc.geoGridPoints;
        externalApiCalls += acc.serpChecks + acc.kwGapChecks + acc.backlinkRuns;
        tokensSpent += Math.max(0, acc.tokensSpent);
        tokensShortfall += acc.tokensShortfall;
        projectsCount += orgProjectCounts.get(oid) ?? 0;
        websitesCount += orgWebsiteCounts.get(oid) ?? 0;
        mrrUsd += this.tierMrr(acc.tier) * shareFactor;

        const w = walletByOrg.get(oid);
        const monthly = w?.monthlyAllowance ?? tokenConfig.monthlyAllowance;
        const allowanceRem = w ? (now >= w.periodEnd ? monthly : w.allowanceBalance) : monthly;
        const bonus = w?.bonusBalance ?? 0;
        tokensAvailable += allowanceRem + bonus;
        tokensMonthly += monthly;
        tokensBonus += bonus;

        if (acc.lastActivityAt && (!lastActivityAt || acc.lastActivityAt > lastActivityAt)) {
          lastActivityAt = acc.lastActivityAt;
        }
        for (const [m, count] of acc.models.entries()) {
          modelCounts.set(m, (modelCounts.get(m) ?? 0) + count);
        }
      }

      buckets.aiRouterUsd = roundUsd(buckets.aiRouterUsd);
      buckets.aiVisibilityUsd = roundUsd(buckets.aiVisibilityUsd);
      buckets.crawlerComputeUsd = roundUsd(buckets.crawlerComputeUsd);
      buckets.geoGridUsd = roundUsd(buckets.geoGridUsd);
      buckets.externalApisUsd = roundUsd(buckets.externalApisUsd);
      buckets.totalUsd = roundUsd(buckets.totalUsd);
      buckets.totalInr = roundInr(buckets.totalUsd, this.rates.usdToInr);

      const projectedMonthlyUsd =
        window === 'all' ? buckets.totalUsd : roundUsd((buckets.totalUsd / Math.max(1, daysInWindow)) * 30);
      const tier = primaryOrg?.tier ?? 'founder_free';
      const profitability = classifyProfitability({
        tier,
        mrrUsd: roundUsd(mrrUsd),
        projectedMonthlyUsd,
        totalUsd: buckets.totalUsd,
        freeHighBurnThresholdUsd: this.rates.freeHighBurnThresholdUsd,
      });

      const isOnline = u.sessions.length > 0;
      if (isOnline || lastActivityAt) activeUsers++;
      if (profitability.status === 'FREE_HIGH_BURN') freeHighBurnUsers++;
      if (profitability.status === 'LOSS_MAKING') lossMakingUsers++;

      const topModels = [...modelCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([model, calls]) => ({ model, calls }));

      const lastSessionAt = u.sessions.reduce<Date | null>(
        (latest, s) => (!latest || s.createdAt > latest ? s.createdAt : latest),
        null,
      );

      const tokenUtilizationPct =
        tokensMonthly + tokensBonus > 0
          ? Math.min(100, Math.round((tokensSpent / (tokensMonthly + tokensBonus)) * 100))
          : 0;

      return {
        id: u.id,
        name: fullName,
        email: u.email,
        emailVerified: Boolean(u.emailVerifiedAt),
        authProvider: u.googleSub ? (u.passwordAuthEnabled ? 'google+password' : 'google') : 'password',
        isPlatformAdmin: u.isPlatformAdmin,
        platformAdminRevoked: Boolean(u.platformAdminRevokedAt && !u.isPlatformAdmin),
        isOnline,
        activeSessionsCount: u.sessions.length,
        lastActiveAt: (lastActivityAt ?? lastSessionAt ?? u.createdAt).toISOString(),
        createdAt: u.createdAt.toISOString(),
        primaryOrgId: primaryOrg?.orgId ?? null,
        primaryOrgName: primaryOrg?.name ?? 'Personal',
        primaryRole: primaryMembership?.role ?? 'OWNER',
        subscriptionTier: tier,
        aiMonthlyBudgetUsd: primaryOrg?.aiMonthlyBudgetUsd ?? null,
        workspacesCount: u.memberships.length,
        isSharedWorkspace,
        projectsCount,
        websitesCount,
        tokens: {
          spent: tokensSpent,
          directUserSpent: Math.max(0, userDirectTokens.get(u.id) ?? 0),
          available: tokensAvailable,
          monthlyAllowance: tokensMonthly,
          bonus: tokensBonus,
          shortfall: tokensShortfall,
          utilizationPct: tokenUtilizationPct,
        },
        crawls: {
          total: crawlsTotal,
          failed: crawlsFailed,
          pagesCrawled,
          pagesRendered,
          pagesStatic: Math.max(0, pagesCrawled - pagesRendered),
        },
        ai: {
          calls: aiCalls,
          errors: aiErrors,
          tokens: aiTokens,
          unpricedCalls: unpricedAiCalls,
          topModels,
        },
        apis: {
          geoGridPoints,
          externalApiCalls,
        },
        cost: buckets,
        projectedMonthlyUsd,
        projectedMonthlyInr: roundInr(projectedMonthlyUsd, this.rates.usdToInr),
        mrrUsd: roundUsd(mrrUsd),
        netMarginUsd: profitability.netMarginUsd,
        marginPct: profitability.marginPct,
        profitabilityStatus: profitability.status,
      };
    });

    // Sort highest cost first by default
    userRows.sort((a, b) => b.cost.totalUsd - a.cost.totalUsd || b.tokens.spent - a.tokens.spent);

    return {
      window,
      since: since ? since.toISOString() : null,
      rates: this.getRates(),
      summary: {
        totalUsers: users.length,
        activeUsers,
        freeHighBurnUsers,
        lossMakingUsers,
        totalCostUsd: platformBuckets.totalUsd,
        totalCostInr: platformBuckets.totalInr,
        totalMrrUsd: roundUsd(platformMrrUsd),
        netMarginUsd: roundUsd(platformMrrUsd - platformBuckets.totalUsd),
        avgCostPerUserUsd: users.length > 0 ? roundUsd(platformBuckets.totalUsd / users.length) : 0,
        totalTokensSpent: platformTokensSpent,
        totalCrawls: platformCrawls,
        totalPagesCrawled: platformPagesCrawled,
        totalRenderedPages: platformRenderedPages,
        totalAiCalls: platformAiCalls,
        totalAiTokens: platformAiTokens,
        buckets: platformBuckets,
      },
      users: userRows,
    };
  }

  /**
   * Deep single-user 360° telemetry, cost breakdown, 14d/30d daily burn trend,
   * AI model/task matrix, crawl history, wallet status, and activity timeline.
   */
  async getUser360(userId: string, windowInput?: string) {
    const now = new Date();
    const { window, since, daysInWindow } = resolveWindowStart(windowInput, now);
    const createdAtFilter = since ? { gte: since } : undefined;
    const tokenConfig = readTokenConfig();

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerifiedAt: true,
        googleSub: true,
        passwordAuthEnabled: true,
        isPlatformAdmin: true,
        platformAdminGrantedAt: true,
        platformAdminRevokedAt: true,
        createdAt: true,
        sessions: {
          where: { revokedAt: null, expiresAt: { gt: now } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, createdAt: true, expiresAt: true },
        },
        memberships: {
          select: {
            role: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
                subscriptionTier: true,
                aiMonthlyBudgetUsd: true,
                whiteLabelEnabled: true,
                createdAt: true,
                members: { select: { userId: true } },
                tokenWallet: true,
              },
            },
          },
        },
      },
    });

    if (!user) throw new NotFoundException(`User "${userId}" not found.`);

    const orgIds = user.memberships.map((m) => m.organization.id);
    const projects = orgIds.length
      ? await this.prisma.project.findMany({
          where: { organizationId: { in: orgIds } },
          select: { id: true, name: true, organizationId: true },
        })
      : [];
    const projectIds = projects.map((p) => p.id);

    const websites = projectIds.length
      ? await this.prisma.website.findMany({
          where: {
            OR: [
              { projectId: { in: projectIds } },
              { scope: { in: projectIds.map((id) => `competitor:${id}`) } },
            ],
          },
          select: {
            id: true,
            domain: true,
            url: true,
            scope: true,
            projectId: true,
            isVerified: true,
            crawlFrequency: true,
            maxConcurrency: true,
            maxDepth: true,
          },
        })
      : [];
    const websiteIds = websites.map((w) => w.id);
    const websiteMap = new Map(websites.map((w) => [w.id, w]));

    const [
      crawlJobs,
      aiUsageRows,
      aiVisRows,
      tokenTxRows,
      geoGridRows,
      serpRows,
      kwGapRows,
      backlinkRows,
      fixCount,
      reportCount,
      voiceCount,
      auditLogs,
    ] = await Promise.all([
      websiteIds.length && this.prisma.crawlJob?.findMany
        ? this.prisma.crawlJob
            .findMany({
              where: {
                websiteId: { in: websiteIds },
                ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
              },
              orderBy: { createdAt: 'desc' },
              take: 50,
              select: {
                id: true,
                websiteId: true,
                status: true,
                pagesCrawled: true,
                pagesDiscovered: true,
                issuesFound: true,
                startedAt: true,
                finishedAt: true,
                errorMessage: true,
                createdAt: true,
              },
            })
            .catch(() => [])
        : Promise.resolve([]),
      orgIds.length && this.prisma.aiUsageRecord?.findMany
        ? this.prisma.aiUsageRecord
            .findMany({
              where: {
                OR: [
                  { organizationId: { in: orgIds } },
                  ...(projectIds.length ? [{ projectId: { in: projectIds } }] : []),
                ],
                ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
              },
              orderBy: { createdAt: 'desc' },
              select: {
                organizationId: true,
                taskType: true,
                provider: true,
                model: true,
                inputTokens: true,
                outputTokens: true,
                estimatedCostUsd: true,
                latencyMs: true,
                status: true,
                createdAt: true,
              },
            })
            .catch(() => [])
        : Promise.resolve([]),
      projectIds.length && this.prisma.aiVisibilityProviderUsage?.findMany
        ? this.prisma.aiVisibilityProviderUsage
            .findMany({
              where: {
                projectId: { in: projectIds },
                ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
              },
              select: {
                provider: true,
                model: true,
                inputTokens: true,
                outputTokens: true,
                cost: true,
                createdAt: true,
              },
            })
            .catch(() => [])
        : Promise.resolve([]),
      orgIds.length && this.prisma.tokenTransaction?.findMany
        ? this.prisma.tokenTransaction
            .findMany({
              where: {
                organizationId: { in: orgIds },
                ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
              },
              orderBy: { createdAt: 'desc' },
              take: 60,
              select: {
                id: true,
                organizationId: true,
                kind: true,
                action: true,
                allowanceDelta: true,
                bonusDelta: true,
                shortfall: true,
                allowanceAfter: true,
                bonusAfter: true,
                userId: true,
                detail: true,
                createdAt: true,
              },
            })
            .catch(() => [])
        : Promise.resolve([]),
      projectIds.length && this.prisma.geoGridRun?.findMany
        ? this.prisma.geoGridRun
            .findMany({
              where: {
                projectId: { in: projectIds },
                ...(createdAtFilter ? { ranAt: createdAtFilter } : {}),
              },
              select: { id: true, keyword: true, gridSize: true, ranAt: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
      projectIds.length && this.prisma.serpSnapshot?.findMany
        ? this.prisma.serpSnapshot
            .findMany({
              where: {
                projectId: { in: projectIds },
                ...(createdAtFilter ? { checkedAt: createdAtFilter } : {}),
              },
              select: { costUsd: true, checkedAt: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
      projectIds.length && this.prisma.keywordGapSnapshot?.findMany
        ? this.prisma.keywordGapSnapshot
            .findMany({
              where: {
                projectId: { in: projectIds },
                ...(createdAtFilter ? { fetchedAt: createdAtFilter } : {}),
              },
              select: { costUsd: true, fetchedAt: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
      projectIds.length && this.prisma.backlinkDiscoveryRun?.findMany
        ? this.prisma.backlinkDiscoveryRun
            .findMany({
              where: {
                projectId: { in: projectIds },
                ...(createdAtFilter ? { startedAt: createdAtFilter } : {}),
              },
              select: { id: true, status: true, startedAt: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
      projectIds.length && this.prisma.fixIntervention?.count
        ? this.prisma.fixIntervention
            .count({
              where: {
                projectId: { in: projectIds },
                ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
              },
            })
            .catch(() => 0)
        : Promise.resolve(0),
      projectIds.length && this.prisma.auditReportSnapshot?.count
        ? this.prisma.auditReportSnapshot
            .count({
              where: {
                projectId: { in: projectIds },
                ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
              },
            })
            .catch(() => 0)
        : Promise.resolve(0),
      this.prisma.voiceSession?.count
        ? this.prisma.voiceSession
            .count({
              where: {
                userId,
                ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
              },
            })
            .catch(() => 0)
        : Promise.resolve(0),
      this.prisma.auditLog?.findMany
        ? this.prisma.auditLog
            .findMany({
              where: { userId },
              orderBy: { createdAt: 'desc' },
              take: 25,
              select: { id: true, action: true, resource: true, createdAt: true },
            })
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    const crawlJobIds = (crawlJobs as any[]).map((c) => c.id);
    const renderedByJobRaw =
      crawlJobIds.length && this.prisma.page?.groupBy
        ? await this.prisma.page
            .groupBy({
              by: ['crawlJobId'],
              where: { crawlJobId: { in: crawlJobIds }, jsRequired: true },
              _count: { _all: true },
            })
            .catch(() => [])
        : [];
    const renderedByJob = new Map<string, number>();
    for (const r of renderedByJobRaw as any[]) {
      renderedByJob.set(r.crawlJobId, r._count?._all ?? 0);
    }

    // Daily trend buckets (last 14 days)
    const dayMap = new Map<string, { date: string; aiUsd: number; crawlUsd: number; apisUsd: number; totalUsd: number }>();
    const trendDays = window === '7d' ? 7 : 14;
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      dayMap.set(key, { date: key, aiUsd: 0, crawlUsd: 0, apisUsd: 0, totalUsd: 0 });
    }
    const addDay = (date: Date, kind: 'aiUsd' | 'crawlUsd' | 'apisUsd', usd: number) => {
      const key = date.toISOString().slice(0, 10);
      const entry = dayMap.get(key);
      if (!entry) return;
      entry[kind] = roundUsd(entry[kind] + usd);
      entry.totalUsd = roundUsd(entry.totalUsd + usd);
    };

    // Model + Task matrix
    const modelMap = new Map<
      string,
      { provider: string; model: string; calls: number; errors: number; inputTokens: number; outputTokens: number; latencySum: number; costUsd: number }
    >();
    const taskMap = new Map<string, { taskType: string; calls: number; tokens: number; costUsd: number }>();

    let aiRouterUsd = 0;
    let unpricedAiCalls = 0;
    for (const row of aiUsageRows as any[]) {
      const est = estimateModelCostUsd(row.model, row.inputTokens || 0, row.outputTokens || 0, row.estimatedCostUsd);
      aiRouterUsd += est.costUsd;
      if (!est.priced) unpricedAiCalls += 1;
      addDay(row.createdAt, 'aiUsd', est.costUsd);

      const mk = `${row.provider}::${row.model}`;
      const m = modelMap.get(mk) ?? {
        provider: row.provider,
        model: row.model,
        calls: 0,
        errors: 0,
        inputTokens: 0,
        outputTokens: 0,
        latencySum: 0,
        costUsd: 0,
      };
      m.calls += 1;
      if (row.status !== 'OK') m.errors += 1;
      m.inputTokens += row.inputTokens || 0;
      m.outputTokens += row.outputTokens || 0;
      m.latencySum += row.latencyMs || 0;
      m.costUsd += est.costUsd;
      modelMap.set(mk, m);

      const t = taskMap.get(row.taskType) ?? { taskType: row.taskType, calls: 0, tokens: 0, costUsd: 0 };
      t.calls += 1;
      t.tokens += (row.inputTokens || 0) + (row.outputTokens || 0);
      t.costUsd += est.costUsd;
      taskMap.set(row.taskType, t);
    }

    let aiVisibilityUsd = 0;
    for (const row of aiVisRows as any[]) {
      const cost = Number(row.cost || 0);
      aiVisibilityUsd += cost;
      addDay(row.createdAt, 'aiUsd', cost);

      const mk = `${row.provider}::${row.model}`;
      const m = modelMap.get(mk) ?? {
        provider: row.provider,
        model: row.model,
        calls: 0,
        errors: 0,
        inputTokens: 0,
        outputTokens: 0,
        latencySum: 0,
        costUsd: 0,
      };
      m.calls += 1;
      m.inputTokens += row.inputTokens || 0;
      m.outputTokens += row.outputTokens || 0;
      m.costUsd += cost;
      modelMap.set(mk, m);

      const t = taskMap.get('AI_VISIBILITY_SCAN') ?? { taskType: 'AI_VISIBILITY_SCAN', calls: 0, tokens: 0, costUsd: 0 };
      t.calls += 1;
      t.tokens += (row.inputTokens || 0) + (row.outputTokens || 0);
      t.costUsd += cost;
      taskMap.set('AI_VISIBILITY_SCAN', t);
    }

    let pagesCrawled = 0;
    let pagesRendered = 0;
    let crawlerComputeUsd = 0;
    const formattedCrawls = (crawlJobs as any[]).map((c) => {
      const pages = Math.max(0, c.pagesCrawled || 0);
      const rendered = Math.min(pages, renderedByJob.get(c.id) ?? 0);
      const staticP = Math.max(0, pages - rendered);
      const costUsd = roundUsd(staticP * this.rates.staticPageCostUsd + rendered * this.rates.renderedPageCostUsd);
      pagesCrawled += pages;
      pagesRendered += rendered;
      crawlerComputeUsd += costUsd;
      addDay(c.createdAt, 'crawlUsd', costUsd);
      const w = websiteMap.get(c.websiteId);
      return {
        id: c.id,
        websiteId: c.websiteId,
        domain: w?.domain ?? 'unknown',
        scope: w?.scope ?? 'own',
        status: c.status,
        pagesCrawled: pages,
        pagesDiscovered: c.pagesDiscovered || 0,
        pagesRendered: rendered,
        issuesFound: c.issuesFound || 0,
        costUsd,
        costInr: roundInr(costUsd, this.rates.usdToInr),
        errorMessage: c.errorMessage ?? null,
        createdAt: c.createdAt.toISOString(),
        finishedAt: c.finishedAt ? c.finishedAt.toISOString() : null,
      };
    });

    let geoGridPoints = 0;
    let geoGridUsd = 0;
    for (const g of geoGridRows as any[]) {
      const pts = Math.max(1, g.gridSize || 3) ** 2;
      const cost = pts * this.rates.geoGridPointCostUsd;
      geoGridPoints += pts;
      geoGridUsd += cost;
      addDay(g.ranAt, 'apisUsd', cost);
    }

    let externalApisUsd = 0;
    for (const s of serpRows as any[]) {
      const cost = typeof s.costUsd === 'number' && s.costUsd >= 0 ? s.costUsd : this.rates.serpFallbackCostUsd;
      externalApisUsd += cost;
      addDay(s.checkedAt, 'apisUsd', cost);
    }
    for (const k of kwGapRows as any[]) {
      const cost = typeof k.costUsd === 'number' && k.costUsd >= 0 ? k.costUsd : this.rates.keywordGapFallbackCostUsd;
      externalApisUsd += cost;
      addDay(k.fetchedAt, 'apisUsd', cost);
    }
    for (const b of backlinkRows as any[]) {
      const cost = this.rates.backlinkRunCostUsd;
      externalApisUsd += cost;
      addDay(b.startedAt, 'apisUsd', cost);
    }

    const totalUsd = roundUsd(aiRouterUsd + aiVisibilityUsd + crawlerComputeUsd + geoGridUsd + externalApisUsd);
    const totalInr = roundInr(totalUsd, this.rates.usdToInr);
    const projectedMonthlyUsd =
      window === 'all' ? totalUsd : roundUsd((totalUsd / Math.max(1, daysInWindow)) * 30);

    const primaryMembership = user.memberships.find((m) => m.role === 'OWNER') ?? user.memberships[0] ?? null;
    const primaryTier = primaryMembership?.organization.subscriptionTier || 'founder_free';
    const mrrUsd = user.memberships.reduce((sum, m) => sum + this.tierMrr(m.organization.subscriptionTier), 0);
    const profitability = classifyProfitability({
      tier: primaryTier,
      mrrUsd,
      projectedMonthlyUsd,
      totalUsd,
      freeHighBurnThresholdUsd: this.rates.freeHighBurnThresholdUsd,
    });

    const workspaces = user.memberships.map((m) => {
      const w = m.organization.tokenWallet;
      const monthly = w?.monthlyAllowance ?? tokenConfig.monthlyAllowance;
      const allowanceRemaining = w ? (now >= w.periodEnd ? monthly : w.allowanceBalance) : monthly;
      const periodGranted = w ? (now >= w.periodEnd ? monthly : w.periodAllowance) : monthly;
      const bonus = w?.bonusBalance ?? 0;
      return {
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
        subscriptionTier: m.organization.subscriptionTier,
        aiMonthlyBudgetUsd: m.organization.aiMonthlyBudgetUsd,
        whiteLabelEnabled: m.organization.whiteLabelEnabled,
        memberCount: m.organization.members.length,
        wallet: {
          available: allowanceRemaining + bonus,
          allowanceRemaining,
          periodGranted,
          monthlyAllowance: monthly,
          customMonthlyAllowance: w?.monthlyAllowance ?? null,
          bonus,
          periodEnd: w?.periodEnd ? w.periodEnd.toISOString() : null,
        },
      };
    });

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email.split('@')[0];

    return {
      window,
      since: since ? since.toISOString() : null,
      rates: this.getRates(),
      user: {
        id: user.id,
        name: fullName,
        email: user.email,
        emailVerified: Boolean(user.emailVerifiedAt),
        authProvider: user.googleSub ? (user.passwordAuthEnabled ? 'google+password' : 'google') : 'password',
        isPlatformAdmin: user.isPlatformAdmin,
        createdAt: user.createdAt.toISOString(),
        activeSessions: user.sessions.map((s) => ({
          id: s.id,
          createdAt: s.createdAt.toISOString(),
          expiresAt: s.expiresAt.toISOString(),
        })),
      },
      workspaces,
      websites: websites.filter((w) => w.scope === 'own' || w.projectId).map((w) => ({
        id: w.id,
        domain: w.domain,
        url: w.url,
        isVerified: w.isVerified,
        crawlFrequency: w.crawlFrequency,
        maxConcurrency: w.maxConcurrency,
        maxDepth: w.maxDepth,
      })),
      cost: {
        aiRouterUsd: roundUsd(aiRouterUsd),
        aiVisibilityUsd: roundUsd(aiVisibilityUsd),
        crawlerComputeUsd: roundUsd(crawlerComputeUsd),
        geoGridUsd: roundUsd(geoGridUsd),
        externalApisUsd: roundUsd(externalApisUsd),
        totalUsd,
        totalInr,
        projectedMonthlyUsd,
        projectedMonthlyInr: roundInr(projectedMonthlyUsd, this.rates.usdToInr),
        mrrUsd: roundUsd(mrrUsd),
        netMarginUsd: profitability.netMarginUsd,
        marginPct: profitability.marginPct,
        profitabilityStatus: profitability.status,
        unpricedAiCalls,
      },
      dailyTrend: [...dayMap.values()].map((d) => ({
        ...d,
        totalInr: roundInr(d.totalUsd, this.rates.usdToInr),
      })),
      models: [...modelMap.values()]
        .map((m) => ({
          provider: m.provider,
          model: m.model,
          calls: m.calls,
          errors: m.errors,
          inputTokens: m.inputTokens,
          outputTokens: m.outputTokens,
          avgLatencyMs: m.calls > 0 ? Math.round(m.latencySum / m.calls) : 0,
          costUsd: roundUsd(m.costUsd),
          costInr: roundInr(m.costUsd, this.rates.usdToInr),
        }))
        .sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls),
      tasks: [...taskMap.values()]
        .map((t) => ({
          taskType: t.taskType,
          calls: t.calls,
          tokens: t.tokens,
          costUsd: roundUsd(t.costUsd),
          costInr: roundInr(t.costUsd, this.rates.usdToInr),
        }))
        .sort((a, b) => b.costUsd - a.costUsd || b.calls - a.calls),
      usageSummary: {
        crawlsCount: formattedCrawls.length,
        pagesCrawled,
        pagesRendered,
        aiVisibilityScans: (aiVisRows as any[]).length,
        geoGridRuns: (geoGridRows as any[]).length,
        geoGridPoints,
        serpChecks: (serpRows as any[]).length,
        keywordGapChecks: (kwGapRows as any[]).length,
        backlinkRuns: (backlinkRows as any[]).length,
        fixInterventions: fixCount,
        auditReports: reportCount,
        voiceSessions: voiceCount,
      },
      recentCrawls: formattedCrawls.slice(0, 20),
      recentTokenTransactions: (tokenTxRows as any[]).slice(0, 30).map((tx) => ({
        id: tx.id,
        organizationId: tx.organizationId,
        kind: tx.kind,
        action: tx.action,
        tokens: Number(tx.allowanceDelta || 0) + Number(tx.bonusDelta || 0),
        shortfall: Number(tx.shortfall || 0),
        balanceAfter: Number(tx.allowanceAfter || 0) + Number(tx.bonusAfter || 0),
        userId: tx.userId ?? null,
        detail: tx.detail ?? null,
        createdAt: tx.createdAt.toISOString(),
      })),
      recentAuditEvents: (auditLogs as any[]).map((a) => ({
        id: a.id,
        action: a.action,
        resource: a.resource ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }
}
