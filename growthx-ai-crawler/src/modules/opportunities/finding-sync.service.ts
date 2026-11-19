import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { FindingLifecycle, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { WebsiteAuditAdapter } from '../issues/website-audit.adapter';
import { CompetitorAdapter } from '../market-intelligence/competitor.adapter';
import { AiVisibilityAdapter } from '../ai-visibility/ai-visibility.adapter';
import { BacklinksAdapter } from '../backlinks/backlinks.adapter';
import { BacklinkDiscovery } from '../backlinks/backlink-discovery.service';
import { CrawlerService } from '../crawler/crawler.service';
import { CrawlerGateway } from '../socket/crawler.gateway';
import { OpportunityDetectionService } from './opportunity-detection.service';
import { RoiLearningService } from './roi-learning.service';
import { TrafficAdapter } from './traffic.adapter';
import { FindingAdapter, NormalisedFinding } from './finding-adapter.interface';

export interface SyncResult {
  created: number;
  updated: number;
  resolved: number;
  savedPlansResolved?: number;
  regressionsDetected?: number;
}

export interface SyncProjectOptions {
  /**
   * Optional list of adapter sources to reconcile (e.g. `['WEBSITE']`, `['COMPETITOR']`).
   * When omitted, all adapters are reconciled.
   */
  sources?: string[];
}

/** Maps FindingSync adapter sources to the corresponding SavedPlan source categories. */
const SAVED_PLAN_SOURCES_BY_ADAPTER: Record<string, string[]> = {
  WEBSITE: ['TECHNICAL_AUDIT', 'INTERNAL_LINK'],
  COMPETITOR: ['COMPETITOR_KEYWORD', 'COMPETITOR_CONTENT', 'COMPETITOR_INTERCEPT'],
  MARKET: ['AI_VISIBILITY'],
  AI_VISIBILITY: ['AI_VISIBILITY'],
  BACKLINKS: ['AUTHORITY_GAP'],
};

function normalizeKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\/+$/, '');
}

@Injectable()
export class FindingSyncService implements OnModuleInit {
  private readonly logger = new Logger(FindingSyncService.name);
  private readonly adapters: FindingAdapter[];
  private readonly detectingProjects = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly websiteAuditAdapter: WebsiteAuditAdapter,
    private readonly competitorAdapter: CompetitorAdapter,
    private readonly aiVisibilityAdapter: AiVisibilityAdapter,
    private readonly backlinksAdapter: BacklinksAdapter,
    private readonly trafficAdapter: TrafficAdapter,
    @Optional() private readonly crawler?: CrawlerService,
    @Optional() private readonly backlinkDiscovery?: BacklinkDiscovery,
    @Optional() private readonly opportunityDetection?: OpportunityDetectionService,
    @Optional() private readonly gateway?: CrawlerGateway,
    @Optional() private readonly roiLearning?: RoiLearningService,
  ) {
    this.adapters = [
      this.websiteAuditAdapter,
      this.competitorAdapter,
      this.aiVisibilityAdapter,
      this.backlinksAdapter,
      this.trafficAdapter,
    ];
  }

  onModuleInit(): void {
    this.crawler?.onCrawlCompleted(async (_jobId, websiteId) => {
      const website = await this.prisma.website.findUnique({
        where: { id: websiteId },
        select: { projectId: true, scope: true, project: { select: { organizationId: true } } },
      });
      if (!website?.projectId) return;
      const source = website.scope === 'OWN' ? 'WEBSITE' : 'COMPETITOR';
      const result = await this.syncProject(website.projectId, { sources: [source] });
      this.logger.log(
        `[${website.projectId}] Auto-synced ${source} findings after crawl: +${result.created} ~${result.updated} -${result.resolved}`,
      );

      // Run cross-tab opportunity detectors (excluding Traffic/GA4) so joined
      // crawl + competitor + SEO opportunities appear immediately without waiting for the 5 AM cron.
      const orgId = website.project?.organizationId;
      if (this.opportunityDetection && orgId && !this.detectingProjects.has(website.projectId)) {
        this.detectingProjects.add(website.projectId);
        try {
          const detected = await this.opportunityDetection.detect(orgId, website.projectId, {
            excludeTraffic: true,
          });
          this.logger.log(
            `[${website.projectId}] Auto-detected ${detected.detected} cross-tab opportunities after crawl`,
          );
          if (detected.detected > 0) {
            this.gateway?.broadcastFindingsUpdated(website.projectId, {
              sources: [source, 'OPPORTUNITIES'],
              created: detected.detected,
              updated: 0,
              resolved: 0,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (err) {
          this.logger.warn(
            `[${website.projectId}] Post-crawl opportunity detection failed: ${(err as Error).message}`,
          );
        } finally {
          this.detectingProjects.delete(website.projectId);
        }
      }
    });

    this.backlinkDiscovery?.onDiscoveryCompleted(async (projectId) => {
      const result = await this.syncProject(projectId, { sources: ['BACKLINKS'] });
      this.logger.log(
        `[${projectId}] Auto-synced BACKLINKS findings after discovery: +${result.created} ~${result.updated} -${result.resolved}`,
      );
    });
  }

  /**
   * Reconciles findings across adapters into the single GrowthOpportunity table.
   *
   * Rules:
   * - Present, no existing row -> create (status: OPEN, lifecycle: QUEUED).
   * - Present, row exists -> update mutable fields, bump lastSeenAt. NEVER touch status or lifecycle.
   * - Absent, row is OPEN/QUEUED -> status: RESOLVED, lifecycle: RESOLVED, resolvedAt: now.
   * - Absent, row is DISMISSED -> leave alone.
   * - Absent, row is mid-execution (APPROVED, APPLYING, VERIFYING, etc.) -> leave alone.
   */
  async syncProject(projectId: string, options?: SyncProjectOptions): Promise<SyncResult> {
    const requestedSources = options?.sources?.length
      ? new Set(options.sources.map((s) => s.toUpperCase().trim()))
      : null;

    const targetAdapters = requestedSources
      ? this.adapters.filter((adapter) => requestedSources.has(adapter.source.toUpperCase()))
      : this.adapters;

    if (targetAdapters.length === 0) {
      return { created: 0, updated: 0, resolved: 0 };
    }

    const results = await Promise.allSettled(
      targetAdapters.map((adapter) => adapter.collect(projectId)),
    );

    const collectedFindings: NormalisedFinding[] = [];
    const successfulSources = new Set<string>();
    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      if (res.status === 'fulfilled') {
        successfulSources.add(targetAdapters[i].source);
        for (const f of res.value) {
          if (f.source) successfulSources.add(f.source);
        }
        collectedFindings.push(...res.value);
      } else {
        this.logger.error(
          `Adapter ${targetAdapters[i].constructor.name} failed for project ${projectId}: ${res.reason}`,
        );
      }
    }

    const roiWeights = this.roiLearning
      ? await this.roiLearning.computeCategoryWeights(projectId).catch(() => new Map())
      : new Map();

    const collectedFingerprints = new Set<string>();
    let created = 0;
    let updated = 0;
    let resolved = 0;
    let regressionsDetected = 0;

    const now = new Date();

    for (const finding of collectedFindings) {
      collectedFingerprints.add(finding.fingerprint);

      const scored = this.roiLearning
        ? this.roiLearning.applyRoiWeight(finding, roiWeights)
        : {
            impact: finding.impact,
            priority: finding.impact * (finding.confidence / 100),
            evidence: finding.evidence,
          };

      const existing = await this.prisma.growthOpportunity.findUnique({
        where: {
          projectId_fingerprint: {
            projectId,
            fingerprint: finding.fingerprint,
          },
        },
      });

      if (!existing) {
        await this.prisma.growthOpportunity.create({
          data: {
            projectId,
            organizationId: finding.organizationId,
            fingerprint: finding.fingerprint,
            source: finding.source,
            category: finding.category,
            title: finding.title,
            summary: finding.summary,
            recommendedAction: finding.recommendedAction,
            evidence: scored.evidence as unknown as Prisma.InputJsonValue,
            potential: finding.potential,
            effort: finding.effort,
            confidence: finding.confidence,
            priority: scored.priority,
            impact: scored.impact,
            fixClass: finding.fixClass,
            affectedPages: finding.affectedPages,
            affectedCount: finding.affectedCount,
            detailType: finding.detailType,
            detailRef: finding.detailRef,
            status: 'OPEN',
            lifecycle: FindingLifecycle.QUEUED,
            detectedAt: now,
            lastSeenAt: now,
            lastTransitionAt: now,
            transitions: [
              {
                from: 'DETECTED',
                to: 'QUEUED',
                at: now.toISOString(),
                actor: { type: 'SYSTEM' },
                reason: 'Auto-queued from detector sweep',
              },
            ] as unknown as Prisma.InputJsonValue,
          },
        });
        created++;
      } else {
        // Automatic Regression Guard: if a previously RESOLVED, VERIFIED, or MEASURED
        // issue reappears in a newer crawl/detector sweep, reopen it and boost priority.
        // DISMISSED, SNOOZED, and active/in-progress states are never overwritten.
        const isRegression =
          existing.status === 'RESOLVED' ||
          existing.lifecycle === FindingLifecycle.RESOLVED ||
          existing.lifecycle === FindingLifecycle.VERIFIED ||
          existing.lifecycle === FindingLifecycle.MEASURED;

        if (isRegression) {
          regressionsDetected++;
          const boostedImpact = Math.min(100, scored.impact + 10);
          const boostedPriority = Number((boostedImpact * (finding.confidence / 100)).toFixed(2));
          const existingTransitions = Array.isArray(existing.transitions)
            ? (existing.transitions as any[])
            : [];
          const regressionEvidence = [
            {
              label: 'Regression detected',
              value: `Reappeared after prior ${existing.lifecycle === FindingLifecycle.VERIFIED || existing.lifecycle === FindingLifecycle.MEASURED ? 'verified fix' : 'resolution'}`,
              source: 'Regression Guard',
            },
            ...(scored.evidence ?? []).filter((e) => e?.label !== 'Regression detected'),
          ];

          await this.prisma.growthOpportunity.update({
            where: { id: existing.id },
            data: {
              title: finding.title,
              summary: finding.summary,
              recommendedAction: finding.recommendedAction,
              evidence: regressionEvidence as unknown as Prisma.InputJsonValue,
              potential: finding.potential,
              effort: finding.effort,
              confidence: finding.confidence,
              priority: boostedPriority,
              impact: boostedImpact,
              fixClass: finding.fixClass,
              affectedPages: finding.affectedPages,
              affectedCount: finding.affectedCount,
              detailType: finding.detailType,
              detailRef: finding.detailRef,
              status: 'OPEN',
              lifecycle: FindingLifecycle.QUEUED,
              resolvedAt: null,
              lastSeenAt: now,
              lastTransitionAt: now,
              transitions: [
                ...existingTransitions,
                {
                  from: existing.lifecycle,
                  to: FindingLifecycle.QUEUED,
                  at: now.toISOString(),
                  actor: { type: 'SYSTEM' },
                  reason: 'Regression Guard: previously fixed/resolved issue reappeared',
                },
              ] as unknown as Prisma.InputJsonValue,
            },
          });

          if (
            (existing.lifecycle === FindingLifecycle.VERIFIED ||
              existing.lifecycle === FindingLifecycle.MEASURED) &&
            this.prisma.fixImpactLedgerEvent?.create
          ) {
            await this.prisma.fixImpactLedgerEvent
              .create({
                data: {
                  projectId,
                  eventType: 'REGRESSION_DETECTED',
                  title: `Regression detected: ${finding.title}`,
                  description: `A previously verified issue reappeared during a subsequent ${finding.source} check and was automatically reopened in Fix Engine.`,
                  actor: 'REGRESSION_GUARD',
                  affectedUrl: finding.affectedPages?.[0] ?? null,
                  verificationStatus: 'REGRESSED',
                  evidenceData: {
                    findingId: existing.id,
                    fingerprint: finding.fingerprint,
                    category: finding.category,
                    source: finding.source,
                    affectedPages: finding.affectedPages,
                  },
                },
              })
              .catch(() => null);
          }
          updated++;
        } else {
          // Row exists and is active/dismissed/in-progress: update mutable fields only.
          await this.prisma.growthOpportunity.update({
            where: { id: existing.id },
            data: {
              title: finding.title,
              summary: finding.summary,
              recommendedAction: finding.recommendedAction,
              evidence: scored.evidence as unknown as Prisma.InputJsonValue,
              potential: finding.potential,
              effort: finding.effort,
              confidence: finding.confidence,
              priority: scored.priority,
              impact: scored.impact,
              fixClass: finding.fixClass,
              affectedPages: finding.affectedPages,
              affectedCount: finding.affectedCount,
              detailType: finding.detailType,
              detailRef: finding.detailRef,
              lastSeenAt: now,
            },
          });
          updated++;
        }
      }
    }

    // Identify rows that are no longer detected
    const allStoredOpportunities = await this.prisma.growthOpportunity.findMany({
      where: { projectId },
      select: {
        id: true,
        fingerprint: true,
        source: true,
        title: true,
        affectedPages: true,
        status: true,
        lifecycle: true,
        transitions: true,
      },
    });

    const resolvedOpportunities: Array<{ source: string; title?: string; affectedPages?: string[] }> = [];

    for (const stored of allStoredOpportunities) {
      // A failed adapter supplied no evidence either way. Never turn that
      // observability gap into a false "resolved" finding.
      if (!successfulSources.has(stored.source)) {
        continue;
      }
      if (collectedFingerprints.has(stored.fingerprint)) {
        continue;
      }

      // If absent and row was OPEN/QUEUED/DETECTED, mark it as resolved
      const isOpenState =
        stored.status === 'OPEN' &&
        (stored.lifecycle === FindingLifecycle.QUEUED ||
          stored.lifecycle === FindingLifecycle.DETECTED);

      if (isOpenState) {
        const existingTransitions = Array.isArray(stored.transitions)
          ? (stored.transitions as any[])
          : [];

        await this.prisma.growthOpportunity.update({
          where: { id: stored.id },
          data: {
            status: 'RESOLVED',
            lifecycle: FindingLifecycle.RESOLVED,
            resolvedAt: now,
            lastTransitionAt: now,
            transitions: [
              ...existingTransitions,
              {
                from: stored.lifecycle,
                to: FindingLifecycle.RESOLVED,
                at: now.toISOString(),
                actor: { type: 'SYSTEM' },
                reason: 'Problem no longer observed in detector sweep',
              },
            ] as unknown as Prisma.InputJsonValue,
          },
        });
        resolved++;
        resolvedOpportunities.push({
          source: stored.source,
          title: stored.title,
          affectedPages: stored.affectedPages,
        });
      }
      // If row was DISMISSED, SNOOZED, or mid-execution (APPROVED, APPLYING, VERIFYING, etc.),
      // leave it alone!
    }

    const savedPlansResolved = await this.reconcileSavedPlans(
      projectId,
      resolvedOpportunities,
      collectedFindings,
    );

    if (successfulSources.size > 0) {
      this.gateway?.broadcastFindingsUpdated(projectId, {
        sources: Array.from(successfulSources),
        created,
        updated,
        resolved,
        ...(savedPlansResolved > 0 ? { savedPlansResolved } : {}),
        ...(regressionsDetected > 0 ? { regressionsDetected } : {}),
        updatedAt: now.toISOString(),
      });
    }

    return {
      created,
      updated,
      resolved,
      ...(savedPlansResolved > 0 ? { savedPlansResolved } : {}),
      ...(regressionsDetected > 0 ? { regressionsDetected } : {}),
    };
  }

  /**
   * Reconciles manually staged SavedPlan items when their underlying findings
   * are resolved by a newer crawl or detector sweep, preventing stale staged
   * tasks from lingering in Fix Engine.
   */
  private async reconcileSavedPlans(
    projectId: string,
    resolvedOpportunities: Array<{ source: string; title?: string; affectedPages?: string[] }>,
    activeFindings: NormalisedFinding[],
  ): Promise<number> {
    if (resolvedOpportunities.length === 0 || !this.prisma.savedPlan?.findMany) {
      return 0;
    }

    const affectedPlanSources = new Set<string>();
    const resolvedTitlesByPlanSource = new Map<string, Set<string>>();
    const resolvedUrlsByPlanSource = new Map<string, Set<string>>();

    for (const opp of resolvedOpportunities) {
      const mapped = SAVED_PLAN_SOURCES_BY_ADAPTER[opp.source.toUpperCase()] ?? [];
      for (const planSource of mapped) {
        affectedPlanSources.add(planSource);
        if (opp.title) {
          const titles = resolvedTitlesByPlanSource.get(planSource) ?? new Set<string>();
          titles.add(normalizeKey(opp.title));
          resolvedTitlesByPlanSource.set(planSource, titles);
        }
        for (const page of opp.affectedPages ?? []) {
          const normalized = normalizeKey(page);
          if (!normalized) continue;
          const urls = resolvedUrlsByPlanSource.get(planSource) ?? new Set<string>();
          urls.add(normalized);
          resolvedUrlsByPlanSource.set(planSource, urls);
        }
      }
    }

    if (affectedPlanSources.size === 0) return 0;

    // Never resolve a staged plan if an active finding still references the same title or URL for that source.
    const activeTitlesByPlanSource = new Map<string, Set<string>>();
    const activeUrlsByPlanSource = new Map<string, Set<string>>();
    for (const finding of activeFindings) {
      const mapped = SAVED_PLAN_SOURCES_BY_ADAPTER[finding.source.toUpperCase()] ?? [];
      for (const planSource of mapped) {
        const titles = activeTitlesByPlanSource.get(planSource) ?? new Set<string>();
        titles.add(normalizeKey(finding.title));
        activeTitlesByPlanSource.set(planSource, titles);
        for (const page of finding.affectedPages ?? []) {
          const normalized = normalizeKey(page);
          if (!normalized) continue;
          const urls = activeUrlsByPlanSource.get(planSource) ?? new Set<string>();
          urls.add(normalized);
          activeUrlsByPlanSource.set(planSource, urls);
        }
      }
    }

    const openPlans = await this.prisma.savedPlan.findMany({
      where: {
        projectId,
        status: { in: ['STAGED', 'APPROVED'] },
        source: { in: Array.from(affectedPlanSources) },
      },
      select: { id: true, source: true, title: true, affectedUrl: true },
    });

    const idsToResolve: string[] = [];
    for (const plan of openPlans) {
      const planTitle = normalizeKey(plan.title);
      const planUrl = normalizeKey(plan.affectedUrl);
      const resolvedTitles = resolvedTitlesByPlanSource.get(plan.source);
      const resolvedUrls = resolvedUrlsByPlanSource.get(plan.source);
      const activeTitles = activeTitlesByPlanSource.get(plan.source);
      const activeUrls = activeUrlsByPlanSource.get(plan.source);

      const titleResolved = Boolean(
        planTitle && resolvedTitles?.has(planTitle) && !activeTitles?.has(planTitle),
      );
      const urlResolved = Boolean(
        planUrl && resolvedUrls?.has(planUrl) && !activeUrls?.has(planUrl),
      );

      if (titleResolved || urlResolved) {
        idsToResolve.push(plan.id);
      }
    }

    if (idsToResolve.length === 0) return 0;

    await this.prisma.savedPlan.updateMany({
      where: { projectId, id: { in: idsToResolve } },
      data: { status: 'EXECUTED' },
    });

    return idsToResolve.length;
  }
}
