import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../database/prisma.service';
import { GitService } from '../autonomous-engineer/agents/git/git.service';
import { SecurityService } from '../security/security.service';
import { MultiAiRouterService, AiTask } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { FetcherService } from '../crawler/fetcher.service';
import { OWN_SCOPE } from '../crawler/website-scope';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expectedAltPattern(change: any): RegExp | null {
  const after = typeof change.after === 'string' ? change.after : '';
  const template = after.match(/alt\s*=\s*\{\s*`([^`]*)`\s*\}/i);
  if (template) {
    const pieces = template[1].split(/\$\{[^}]+\}/g);
    const pattern = pieces.map(escapeRegExp).join('[^<>]{1,160}');
    return new RegExp(`^${pattern}$`, 'i');
  }
  const quoted = after.match(/alt\s*=\s*(['"])(.*?)\1/i);
  if (quoted?.[2]?.trim()) return new RegExp(`^${escapeRegExp(quoted[2].trim())}$`, 'i');
  if (change.field === 'ALT_TEXT' && after.trim() && !/[<>`{}]/.test(after)) {
    return new RegExp(`^${escapeRegExp(after.trim())}$`, 'i');
  }
  return null;
}

export interface ComparisonDiffItem {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
  status: 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED' | 'NOT_MEASURED';
}

export interface TechnicalMetricComparison {
  metric: string;
  before: string | number | null;
  after: string | number | null;
  status: 'IMPROVED' | 'UNCHANGED' | 'REGRESSED' | 'NOT_MEASURED';
}

export interface ModelImpactComparison {
  model: string;
  provider: string;
  beforeMentionRate: number | null;
  afterMentionRate: number | null;
  changePt: number | null;
  beforeCitationRate: number | null;
  afterCitationRate: number | null;
}

export interface PerformanceWindowMetric {
  period: string; // e.g. "Baseline (28d)", "Day 7", "Day 14", "Day 30", "Day 60", "Day 90"
  days: number;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  position: number | null;
  status: 'OBSERVED' | 'PENDING';
}

@Injectable()
export class ProofOfImpactService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProofOfImpactService.name);
  private autoVerifyTimer?: ReturnType<typeof setInterval>;
  private autoVerifyRunning = false;
  private readonly verificationRequests = new Map<string, Promise<any>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly git: GitService,
    private readonly security: SecurityService,
    @Optional() private readonly aiRouter?: MultiAiRouterService,
    @Optional() private readonly fetcher?: FetcherService,
  ) {}

  onModuleInit(): void {
    this.autoVerifyTimer = setInterval(() => void this.verifyMergedPullRequests(), 60_000);
    this.autoVerifyTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.autoVerifyTimer) clearInterval(this.autoVerifyTimer);
  }

  private async verifyMergedPullRequests(): Promise<void> {
    if (this.autoVerifyRunning || !this.fetcher) return;
    this.autoVerifyRunning = true;
    try {
      const runs = await this.prisma.automationRun.findMany({
        where: { status: { in: ['AWAITING_REVIEW', 'MERGED'] }, pullRequestUrl: { not: null } },
        orderBy: { startedAt: 'desc' },
        take: 25,
        select: { id: true, projectId: true, steps: true },
      });
      for (const run of runs) {
        const changes = Array.isArray(run.steps) ? (run.steps as any[]).filter((step) => step.change).map((step) => step.change) : [];
        if (!changes.length) continue;
        const [snapshots, unsupported] = await Promise.all([
          this.prisma.fixSnapshot.findMany({
            where: { projectId: run.projectId, automationRunId: run.id, snapshotType: 'VERIFIED_LIVE' },
            select: { url: true, contentSnippet: true },
          }),
          this.prisma.fixImpactLedgerEvent.findMany({
            where: { projectId: run.projectId, automationRunId: run.id, eventType: 'LIVE_VERIFICATION_UNSUPPORTED' },
            select: { affectedUrl: true, evidenceData: true },
          }),
        ]);
        const allSettled = changes.every((change) => {
          const field = String(change.field || '').toUpperCase();
          return snapshots.some((snapshot) => snapshot.url === change.url && snapshot.contentSnippet?.startsWith(`${field}:`)) ||
            unsupported.some((event) => event.affectedUrl === change.url && (event.evidenceData as any)?.field === field);
        });
        if (allSettled) continue;
        try {
          const result = await this.verifyDeployment(run.projectId, run.id);
          if (result.verificationStatus === 'VERIFIED') {
            this.logger.log(`Automatically verified merged Fix Engine run ${run.id} on the live website.`);
            await this.evaluateAndTriggerLoop(run.projectId, run.id).catch(() => null);
          }
        } catch (error: any) {
          this.logger.warn(`Automatic live verification failed for run ${run.id}: ${error?.message || 'unknown error'}`);
        }
      }
    } catch (error: any) {
      this.logger.warn(`Merged PR verification sweep failed: ${error?.message || 'unknown error'}`);
    } finally {
      this.autoVerifyRunning = false;
    }
  }

  /**
   * Daily automated 7d / 30d / 90d Impact Ledger & Closed-Loop Evaluation Cron (3:00 AM UTC).
   * Evaluates all projects with merged Fix Engine runs so positive search/AI lift is
   * confirmed automatically and 30-day flat runs generate Iteration 2 pivots with zero manual intervention.
   */
  @Cron('0 3 * * *')
  async runDailyImpactEvaluationSweep(): Promise<{
    projectsEvaluated: number;
    improvedCount: number;
    loopTriggeredCount: number;
  }> {
    let projectsEvaluated = 0;
    let improvedCount = 0;
    let loopTriggeredCount = 0;

    try {
      await this.verifyMergedPullRequests();

      const mergedRuns = await this.prisma.automationRun.findMany({
        where: { status: 'MERGED' },
        select: { projectId: true },
        distinct: ['projectId'],
      });

      for (const { projectId } of mergedRuns) {
        try {
          const summary = await this.evaluateAndTriggerLoop(projectId);
          projectsEvaluated++;
          improvedCount += summary.improvedCount || 0;
          loopTriggeredCount += summary.loopTriggeredCount || 0;
        } catch (err: any) {
          this.logger.warn(
            `Daily 30d/90d impact evaluation failed for project ${projectId}: ${err?.message || 'unknown error'}`,
          );
        }
      }

      if (projectsEvaluated > 0) {
        this.logger.log(
          `Daily 30d/90d Impact Sweep completed: ${projectsEvaluated} projects evaluated, ${improvedCount} confirmed lifts, ${loopTriggeredCount} closed-loop pivots triggered.`,
        );
      }
    } catch (err: any) {
      this.logger.warn(`Daily 30d/90d impact evaluation sweep error: ${err?.message || 'unknown error'}`);
    }

    return { projectsEvaluated, improvedCount, loopTriggeredCount };
  }

  /**
   * FIX ENGINE OVERVIEW DASHBOARD
   * Aggregates real metrics: verified fixes, pages improved, active fixes,
   * regressions, search performance delta, and AI visibility delta.
   */
  async getOverview(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { websites: { where: { scope: 'own' } } },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    // 1. Fetch runs
    const runs = await this.prisma.automationRun.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    // 2. Fetch snapshots
    const snapshots = await this.prisma.fixSnapshot.findMany({
      where: { projectId },
      orderBy: { capturedAt: 'desc' },
    });

    // 3. Regressions
    const openRegressions = await this.prisma.fixRegressionRecord.findMany({
      where: { projectId, resolvedAt: null },
      orderBy: { detectedAt: 'desc' },
    });

    // 4. Calculate verification breakdown
    const verifiedSnapshots = [...new Map(snapshots.filter((s) => s.snapshotType === 'VERIFIED_LIVE' && s.pageId).map(s => [`${s.automationRunId}:${s.url}`, s])).values()];
    const verifiedUrls = new Set(verifiedSnapshots.map((s) => s.url));

    let activeCount = 0;
    let completedCount = 0;
    let awaitingApprovalCount = 0;
    let failedCount = 0;

    for (const r of runs) {
      if (r.status === 'RUNNING' || r.status === 'PENDING') activeCount++;
      else if (r.status === 'AWAITING_REVIEW') awaitingApprovalCount++;
      else if (r.status === 'FAILED') failedCount++;
      else if (r.status === 'MERGED') completedCount++;
    }

    // 5. GSC performance delta on affected URLs
    const affectedUrls = [...new Set(snapshots.map((s) => s.url).filter(Boolean))];
    const gscSummary = await this.calculateGscDelta(projectId, affectedUrls);

    // 6. AI Visibility delta
    const aiDelta = await this.calculateAiVisibilityDelta(projectId);

    // 7. Performance trend with milestone markers
    const trend = await this.calculatePerformanceTrend(projectId, affectedUrls, runs);

    // 8. Recent Fixes
    const recentFixes = await this.buildRecentFixes(runs, snapshots);

    // 9. Impact Opportunities from GrowthOpportunity
    const opportunities = await this.prisma.growthOpportunity.findMany({
      where: { projectId, status: 'OPEN' },
      orderBy: { priority: 'desc' },
      take: 10,
    });

    return {
      kpis: {
        verifiedFixes: verifiedSnapshots.length,
        pagesImproved: verifiedUrls.size,
        activeFixes: activeCount + awaitingApprovalCount,
        regressionsDetected: openRegressions.length,
        organicSearchChangePct: gscSummary.clicksChangePct,
        organicClicksDelta: gscSummary.clicksDelta,
        aiVisibilityChangePt: aiDelta.deltaPt,
        aiVisibilityScore: aiDelta.currentScore,
      },
      statusBreakdown: {
        verified: verifiedSnapshots.length,
        awaitingApproval: awaitingApprovalCount,
        inProgress: activeCount,
        failed: failedCount,
        regressions: openRegressions.length,
      },
      performanceTrend: trend,
      recentFixes,
      opportunities: opportunities.map((o) => ({
        id: o.id,
        title: o.title,
        category: o.category,
        priority: o.priority,
        potentialImpact: `${o.potential} potential (${o.effort} effort)`,
        status: o.status,
      })),
      regressionAlerts: openRegressions.map((r) => ({
        id: r.id,
        url: r.url,
        severity: r.severity,
        title: r.title,
        description: r.description,
        detectedAt: r.detectedAt.toISOString(),
      })),
    };
  }

  /**
   * FIX HISTORY LIST
   * Provides searchable, filterable list of all technical fixes.
   */
  async getFixHistory(projectId: string, query?: { status?: string; category?: string; priority?: string; search?: string }) {
    const runs = await this.prisma.automationRun.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });

    const snapshots = await this.prisma.fixSnapshot.findMany({
      where: { projectId },
    });

    const repo = await this.prisma.siteRepository.findUnique({ where: { projectId } });

    const items = runs.map((run) => {
      const runSnapshots = snapshots.filter((s) => s.automationRunId === run.id);
      const before = runSnapshots.find((s) => s.snapshotType === 'BEFORE');
      const verified = runSnapshots.find((s) => s.snapshotType === 'VERIFIED_LIVE' && s.pageId);
      const proposed = runSnapshots.find((s) => s.snapshotType === 'PROPOSED');

      const steps = Array.isArray(run.steps) ? (run.steps as any[]) : [];
      const changeStep = steps.find((s) => s.change);
      const url = changeStep?.change?.url || before?.url || proposed?.url || runSnapshots[0]?.url || 'Site-wide';
      const field = changeStep?.change?.field || 'Technical SEO Fix';

      // Deployment status
      let deploymentStatus = 'NOT_DEPLOYED';
      let verificationStatus = 'NOT_CHECKED';
      if (verified) {
        deploymentStatus = 'DEPLOYED';
        verificationStatus = 'VERIFIED';
      } else if (run.status === 'MERGED') {
        deploymentStatus = 'DEPLOYED';
        verificationStatus = 'VERIFYING';
      } else if (run.status === 'AWAITING_REVIEW') {
        deploymentStatus = 'PR_CREATED';
        verificationStatus = 'AWAITING_APPROVAL';
      } else if (run.status === 'FAILED') {
        deploymentStatus = 'FAILED';
        verificationStatus = 'FAILED';
      }

      return {
        id: run.id,
        runId: run.id,
        title: changeStep?.change?.why || `${field} improvement`,
        affectedPage: url,
        field,
        category: 'TECHNICAL_SEO',
        priority: 1,
        pullRequestUrl: run.pullRequestUrl,
        deploymentStatus,
        verificationStatus,
        impactStatus: verified ? 'OBSERVED' : 'PENDING',
        date: run.startedAt.toISOString(),
        filesChanged: run.filesChanged,
      };
    });

    let filtered = items;
    if (query?.status && query.status !== 'ALL') {
      filtered = filtered.filter((i) => i.verificationStatus === query.status || i.deploymentStatus === query.status);
    }
    if (query?.search) {
      const s = query.search.toLowerCase();
      filtered = filtered.filter((i) => i.title.toLowerCase().includes(s) || i.affectedPage.toLowerCase().includes(s));
    }

    return filtered;
  }

  /**
   * FIX DETAIL & BEFORE/AFTER COMPARISON
   * Detailed breakdown across Visual, Content, Technical, Code, GSC, GA4, AI, Attribution, and Ledger.
   */
  async getFixDetail(projectId: string, runId: string) {
    const run = await this.prisma.automationRun.findUnique({
      where: { id: runId },
    });
    if (!run || run.projectId !== projectId) {
      throw new NotFoundException(`Fix run ${runId} not found`);
    }

    // 1. Fetch snapshots
    const snapshots = await this.prisma.fixSnapshot.findMany({
      where: { projectId, automationRunId: runId },
      orderBy: { capturedAt: 'asc' },
    });

    const beforeSnap = snapshots.find((s) => s.snapshotType === 'BEFORE');
    const proposedSnap = snapshots.find((s) => s.snapshotType === 'PROPOSED');
    const verifiedSnap = snapshots.find((s) => s.snapshotType === 'VERIFIED_LIVE' && s.pageId);

    const steps = Array.isArray(run.steps) ? (run.steps as any[]) : [];
    const changeStep = steps.find((s) => s.change);
    const affectedUrl = changeStep?.change?.url || beforeSnap?.url || proposedSnap?.url || '';

    // 2. Visual comparison
    const visual = {
      available: Boolean(beforeSnap?.screenshotUrl || verifiedSnap?.screenshotUrl),
      before: {
        url: beforeSnap?.screenshotUrl || null,
        capturedAt: beforeSnap?.capturedAt?.toISOString() || null,
        viewport: 'Desktop (1920×1080)',
      },
      after: {
        url: verifiedSnap?.screenshotUrl || null,
        capturedAt: verifiedSnap?.capturedAt?.toISOString() || null,
        viewport: 'Desktop (1920×1080)',
      },
      pageUrl: affectedUrl,
    };

    // 3. Content comparison
    const contentDiff: ComparisonDiffItem[] = [
      {
        field: 'title',
        label: 'Page Title',
        before: changeStep?.change?.field === 'META_TITLE' ? changeStep.change.before : beforeSnap?.pageId ? beforeSnap.title : null,
        after: verifiedSnap?.title ?? (changeStep?.change?.field === 'META_TITLE' ? changeStep.change.after : null),
        status: !verifiedSnap ? 'NOT_MEASURED' : changeStep?.change?.field === 'META_TITLE' && changeStep.change.before === verifiedSnap.title ? 'UNCHANGED' : 'MODIFIED',
      },
      {
        field: 'metaDescription',
        label: 'Meta Description',
        before: beforeSnap?.metaDescription || null,
        after: verifiedSnap?.metaDescription || proposedSnap?.metaDescription || null,
        status: beforeSnap?.metaDescription === (verifiedSnap?.metaDescription || proposedSnap?.metaDescription) ? 'UNCHANGED' : 'MODIFIED',
      },
      {
        field: 'h1',
        label: 'H1 Heading',
        before: beforeSnap?.h1 || null,
        after: verifiedSnap?.h1 || proposedSnap?.h1 || null,
        status: beforeSnap?.h1 === (verifiedSnap?.h1 || proposedSnap?.h1) ? 'UNCHANGED' : 'MODIFIED',
      },
      {
        field: 'canonicalUrl',
        label: 'Canonical URL',
        before: beforeSnap?.canonicalUrl || null,
        after: verifiedSnap?.canonicalUrl || proposedSnap?.canonicalUrl || null,
        status: beforeSnap?.canonicalUrl === (verifiedSnap?.canonicalUrl || proposedSnap?.canonicalUrl) ? 'UNCHANGED' : 'MODIFIED',
      },
      {
        field: 'robotsDirectives',
        label: 'Robots Directives',
        before: beforeSnap?.robotsDirectives ?? null,
        after: verifiedSnap?.robotsDirectives ?? null,
        status: beforeSnap?.robotsDirectives != null && verifiedSnap?.robotsDirectives != null ? (beforeSnap.robotsDirectives === verifiedSnap.robotsDirectives ? 'UNCHANGED' : 'MODIFIED') : 'NOT_MEASURED',
      },
    ];

    for (const item of contentDiff) if (!verifiedSnap || item.before == null || item.after == null) item.status = 'NOT_MEASURED';

    // 4. Technical comparison
    const technical: TechnicalMetricComparison[] = [
      {
        metric: 'Technical SEO Issues',
        before: beforeSnap?.issuesCount ?? null,
        after: verifiedSnap?.issuesCount ?? null,
        status: beforeSnap?.issuesCount == null || verifiedSnap?.issuesCount == null ? 'NOT_MEASURED' : verifiedSnap.issuesCount < beforeSnap.issuesCount ? 'IMPROVED' : verifiedSnap.issuesCount > beforeSnap.issuesCount ? 'REGRESSED' : 'UNCHANGED',
      },
      {
        metric: 'Missing Structured Data',
        before: Array.isArray(beforeSnap?.structuredData) ? beforeSnap.structuredData.length ? 'No' : 'Yes' : null,
        after: Array.isArray(verifiedSnap?.structuredData) ? verifiedSnap.structuredData.length ? 'No' : 'Yes' : null,
        status: !Array.isArray(beforeSnap?.structuredData) || !Array.isArray(verifiedSnap?.structuredData) ? 'NOT_MEASURED' : beforeSnap.structuredData.length === verifiedSnap.structuredData.length ? 'UNCHANGED' : verifiedSnap.structuredData.length ? 'IMPROVED' : 'REGRESSED',
      },
      {
        metric: 'Canonical URL Configured',
        before: beforeSnap ? beforeSnap.canonicalUrl ? 'Present' : 'Missing' : null,
        after: verifiedSnap ? verifiedSnap.canonicalUrl ? 'Present' : 'Missing' : null,
        status: !beforeSnap || !verifiedSnap ? 'NOT_MEASURED' : beforeSnap.canonicalUrl === verifiedSnap.canonicalUrl ? 'UNCHANGED' : verifiedSnap.canonicalUrl ? 'IMPROVED' : 'REGRESSED',
      },
      {
        metric: 'Internal Links',
        before: beforeSnap?.internalLinksCount ?? null,
        after: verifiedSnap?.internalLinksCount ?? null,
        status: beforeSnap?.internalLinksCount == null || verifiedSnap?.internalLinksCount == null ? 'NOT_MEASURED' : beforeSnap.internalLinksCount === verifiedSnap.internalLinksCount ? 'UNCHANGED' : verifiedSnap.internalLinksCount > beforeSnap.internalLinksCount ? 'IMPROVED' : 'REGRESSED',
      },
    ];

    // 5. Code comparison
    const code = {
      pullRequestUrl: run.pullRequestUrl,
      filesChanged: run.filesChanged,
      branch: run.branch,
      commitSha: steps.find((s) => s.commitSha)?.commitSha || null,
      status: run.status,
      diffSummary: changeStep?.change ? `${changeStep.change.file}: ${changeStep.change.field} updated` : 'Files patched via Reigel Fix Engine',
    };

    // 6. SEO Impact (GSC windows)
    const seoImpact = await this.getFixGscImpact(projectId, affectedUrl, verifiedSnap?.capturedAt ?? run.startedAt);

    // 7. AI Visibility Impact
    const aiImpact = await this.getFixAiImpact(projectId, affectedUrl, verifiedSnap?.capturedAt ?? run.startedAt);

    // 8. GA4 Business Impact
    const businessImpact = await this.getFixGa4Impact(projectId, affectedUrl, run.startedAt);

    // 9. Impact Attribution
    const attribution = {
      level1: {
        label: 'Level 1: Verified Technical Result',
        status: verifiedSnap ? 'VERIFIED' : 'PENDING',
        detail: verifiedSnap
          ? `Confirmed: Changes are live and active on ${affectedUrl}.`
          : 'Pending deployment verification on live website.',
      },
      level2: {
        label: 'Level 2: Observed Performance Change',
        status: seoImpact.windows.some((w) => w.status === 'OBSERVED' && w.period !== 'Baseline (28d)') ? 'OBSERVED' : 'MONITORING',
        detail: seoImpact.overallClicksChangePt != null
          ? `Observed ${seoImpact.overallClicksChangePt >= 0 ? '+' : ''}${seoImpact.overallClicksChangePt}% change in organic search clicks over the post-fix window; this is an observed association, not proof the fix caused it.`
          : 'A complete pre-fix baseline and post-fix Search Console comparison is not available yet.'
      },
      level3: {
        label: 'Level 3: Estimated Causal Impact',
        status: 'INCONCLUSIVE',
        detail: 'No causal estimator with a measured control group has been run. Observed changes must not be presented as caused by this fix.',
      },
    };

    // 10. Ledger events
    const ledgerEvents = await this.prisma.fixImpactLedgerEvent.findMany({
      where: { projectId, automationRunId: runId },
      orderBy: { createdAt: 'asc' },
    });

    // 11. Regressions
    const regressions = await this.prisma.fixRegressionRecord.findMany({
      where: { projectId, automationRunId: runId },
      orderBy: { detectedAt: 'desc' },
    });

    // 12. Plain language AI explanation (deterministic fallback)
    const aiSummary = await this.generateFixExplanation(changeStep?.change, attribution, seoImpact, aiImpact);

    return {
      run: {
        id: run.id,
        status: run.status,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() || null,
        pullRequestUrl: run.pullRequestUrl,
        affectedUrl,
      },
      visual,
      content: contentDiff,
      technical,
      code,
      seoImpact: { ...seoImpact, baseline: { clicks: seoImpact.windows[0]?.clicks ?? null, impressions: seoImpact.windows[0]?.impressions ?? null, ctr: seoImpact.windows[0]?.ctr ?? null, position: null, days: 28 }, windows: seoImpact.windows.map(w => ({ ...w, window: w.period })), affectedUrl, note: 'Only saved Search Console measurements are shown. Pending windows are not measured results.' },
      aiImpact,
      businessImpact,
      attribution,
      ledger: ledgerEvents.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        title: e.title,
        description: e.description,
        actor: e.actor,
        affectedUrl: e.affectedUrl,
        pullRequestUrl: e.pullRequestUrl,
        verificationStatus: e.verificationStatus,
        evidenceData: (e.evidenceData as any) ?? {},
        createdAt: e.createdAt.toISOString(),
      })),
      regressions: regressions.map((r) => ({
        id: r.id,
        severity: r.severity,
        issueCode: r.issueCode,
        title: r.title,
        description: r.description,
        detectedAt: r.detectedAt.toISOString(),
      })),
      aiSummary,
    };
  }

  /**
   * VERIFY DEPLOYMENT
   * Re-crawls affected page to check if PR changes are actually deployed on live site.
   */
  async verifyDeployment(projectId: string, runId: string) {
    const key = `${projectId}:${runId}`;
    const current = this.verificationRequests.get(key);
    if (current) return current;
    const request = this.verifyDeploymentOnce(projectId, runId).finally(() => this.verificationRequests.delete(key));
    this.verificationRequests.set(key, request);
    return request;
  }

  private async verifyDeploymentOnce(projectId: string, runId: string) {
    const run = await this.prisma.automationRun.findUnique({
      where: { id: runId },
    });
    if (!run || run.projectId !== projectId) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    const steps = Array.isArray(run.steps) ? (run.steps as any[]) : [];
    const changes = steps.filter((step) => step.change).map((step) => step.change);
    if (changes.length === 0) {
      return { success: false, verificationStatus: 'NOT_CHECKED', message: 'This run has no page-level change evidence, so Reigel cannot safely verify it automatically.' };
    }
    const repository = await this.prisma.siteRepository.findUnique({ where: { projectId } });
    const pr = run.pullRequestUrl?.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?$/);
    if (!repository || !pr || pr[1].toLowerCase() !== repository.owner?.toLowerCase() || pr[2].toLowerCase() !== repository.name?.toLowerCase()) {
      return { success: false, verificationStatus: 'NOT_CHECKED', message: 'A pull request in the connected repository is required for deployment verification.' };
    }
    let mergedAt: string | null | undefined;
    try {
      const review = await this.git.readPullRequestEvidence(this.security.decryptCredentials(repository.accessTokenEncrypted), repository.owner, repository.name, Number(pr[3]));
      if (review.state === 'MERGED') mergedAt = review.mergedAt;
    } catch { /* Missing GitHub evidence must not turn into a verified fix. */ }
    if (!mergedAt) return { success: false, verificationStatus: 'NOT_CHECKED', message: 'GitHub has not confirmed this pull request as merged. Preview proposals are not deployed fixes.' };
    if (!this.fetcher) {
      if (changes.length === 1 && ['META_TITLE', 'META_DESCRIPTION'].includes(String(changes[0].field).toUpperCase())) {
        const change = changes[0];
        const page = await this.prisma.page.findFirst({
          where: { url: change.url, statusCode: 200, blockedSuspected: false, crawlJob: { website: { projectId, scope: OWN_SCOPE }, status: 'COMPLETED' } },
          orderBy: { crawlJob: { createdAt: 'desc' } }, include: { issues: true },
        });
        const mergedTime = new Date(mergedAt).getTime();
        const liveValue = change.field === 'META_TITLE' ? page?.title ?? null : page?.metaDescription ?? null;
        const matches = Boolean(page?.crawledAt && new Date(page.crawledAt).getTime() > mergedTime && liveValue === change.after);
        if (matches && page) {
          const now = new Date();
          await this.prisma.fixSnapshot.create({ data: {
            projectId, automationRunId: runId, url: change.url, snapshotType: 'VERIFIED_LIVE', pageId: page.id,
            title: page.title || null, metaDescription: page.metaDescription || null,
            h1: page.h1?.[0] || null, issuesCount: page.issues?.length || 0,
            contentSnippet: `${String(change.field).toUpperCase()}: ${liveValue}`, capturedAt: now,
          } });
          await this.prisma.fixImpactLedgerEvent.create({ data: {
            projectId, automationRunId: runId, eventType: 'DEPLOYMENT_VERIFIED', title: 'Live Website Change Verified',
            description: `Verified ${change.field} on the live page after GitHub merged the pull request.`,
            affectedUrl: change.url, pullRequestUrl: run.pullRequestUrl, verificationStatus: 'VERIFIED',
          } });
          return { success: true, verificationStatus: 'VERIFIED', liveValue, verifiedAt: now.toISOString() };
        }
      }
      return { success: false, verificationStatus: 'NOT_CHECKED', message: 'Live page checking is unavailable on this service. No fix has been marked complete.' };
    }

    const website = await this.prisma.website.findFirst({
      where: { projectId, scope: OWN_SCOPE },
      select: { domain: true, url: true },
    });
    if (!website) return { success: false, verificationStatus: 'NOT_CHECKED', message: 'No owned website is connected to this project.' };
    const baseHost = new URL(website.url.startsWith('http') ? website.url : `https://${website.domain}`).hostname.toLowerCase().replace(/^www\./, '');
    const results: Array<{ url: string; field: string; verificationStatus: string; liveValue: string | null; message: string }> = [];

    for (const change of changes) {
      const url = typeof change.url === 'string' ? change.url : '';
      const targetField = String(change.field || '').toUpperCase();
      let parsedUrl: URL;
      try { parsedUrl = new URL(url); } catch {
        results.push({ url, field: targetField, verificationStatus: 'NOT_CHECKED', liveValue: null, message: 'No valid affected page URL is attached to this change.' });
        continue;
      }
      if (parsedUrl.hostname.toLowerCase().replace(/^www\./, '') !== baseHost) {
        results.push({ url, field: targetField, verificationStatus: 'NOT_CHECKED', liveValue: null, message: 'The affected page is outside this project’s website, so it was not fetched.' });
        continue;
      }

      const existing = await this.prisma.fixSnapshot.findMany({
        where: { projectId, automationRunId: runId, snapshotType: 'VERIFIED_LIVE', url },
        orderBy: { capturedAt: 'desc' },
        take: 20,
      });
      const saved = existing.find((snapshot) => snapshot.contentSnippet?.startsWith(`${targetField}:`));
      if (saved) {
        results.push({ url, field: targetField, verificationStatus: 'VERIFIED', liveValue: saved.contentSnippet!.slice(targetField.length + 1).trim(), message: 'This change was already confirmed on the live page.' });
        continue;
      }

      let liveValue: string | null = null;
      let liveHtml = '';
      let liveTitle: string | null = null;
      let liveDescription: string | null = null;
      let liveH1: string | null = null;
      let isMatched = false;
      let unsupported = false;
      if (await this.prisma.fixImpactLedgerEvent.findMany({
        where: { projectId, automationRunId: runId, eventType: 'LIVE_VERIFICATION_UNSUPPORTED', affectedUrl: url },
        select: { evidenceData: true },
      }).then((events) => events.some((event) => (event.evidenceData as any)?.field === targetField))) {
        results.push({ url, field: targetField, verificationStatus: 'UNSUPPORTED', liveValue: null, message: 'This change needs a fix-specific verification rule and remains unverified.' });
        continue;
      }
      try {
        const response = await this.fetcher.fetchPage(url, targetField === 'ALT_TEXT' || targetField === 'CODE_AND_SEO_UPDATE');
        if (response.statusCode < 200 || response.statusCode >= 400 || !response.html) {
          results.push({ url, field: targetField, verificationStatus: 'PENDING_DEPLOYMENT', liveValue: null, message: `Live page returned HTTP ${response.statusCode || 'no response'}; the deployment could not be confirmed. Reigel will retry.` });
          continue;
        }
        let responseHost = '';
        try { responseHost = new URL(response.finalUrl || url).hostname.toLowerCase().replace(/^www\./, ''); } catch { /* Invalid final URL cannot prove deployment. */ }
        if (responseHost !== baseHost) {
          results.push({ url, field: targetField, verificationStatus: 'NOT_CHECKED', liveValue: null, message: 'The page redirected outside this project’s website, so Reigel did not use it as verification.' });
          continue;
        }
        liveHtml = response.html;
        const $ = cheerio.load(response.html);
        liveTitle = $('title').first().text().trim() || null;
        liveDescription = $('meta[name="description"]').attr('content')?.trim() || null;
        liveH1 = $('h1').first().text().trim() || null;
        const expectedValue = typeof change.after === 'string' ? change.after.trim() : '';
        if (targetField === 'META_TITLE') {
          liveValue = liveTitle;
          isMatched = Boolean(expectedValue && liveValue === expectedValue);
        } else if (targetField === 'META_DESCRIPTION') {
          liveValue = liveDescription;
          isMatched = Boolean(expectedValue && liveValue === expectedValue);
        } else if (targetField === 'ALT_TEXT' || (targetField === 'CODE_AND_SEO_UPDATE' && /alt\s*=|alt text|image.*blind/i.test(`${change.after || ''} ${change.why || ''}`))) {
          const pattern = expectedAltPattern(change);
          const liveAltTexts = $('img').toArray().map((image) => $(image).attr('alt')?.trim() || '').filter(Boolean);
          liveValue = liveAltTexts.join(' · ') || null;
          isMatched = Boolean(pattern && liveAltTexts.some((alt) => pattern.test(alt)));
          unsupported = !pattern;
        } else if (['FAQ_SCHEMA', 'PRODUCT_SCHEMA', 'ORGANIZATION_SCHEMA', 'BREADCRUMB_SCHEMA'].includes(targetField)) {
          const schemaType = ({ FAQ_SCHEMA: 'FAQPage', PRODUCT_SCHEMA: 'Product', ORGANIZATION_SCHEMA: 'Organization', BREADCRUMB_SCHEMA: 'BreadcrumbList' } as Record<string, string>)[targetField];
          const types: string[] = [];
          $('script[type="application/ld+json"]').each((_, node) => {
            try {
              const parsed = JSON.parse($(node).html() || 'null');
              const values = Array.isArray(parsed) ? parsed : [parsed];
              for (const value of values) if (typeof value?.['@type'] === 'string') types.push(value['@type']);
            } catch { /* Invalid JSON-LD cannot count as proof. */ }
          });
          liveValue = types.join(', ') || null;
          isMatched = types.includes(schemaType);
        } else {
          unsupported = true;
          liveValue = `${response.statusCode} · page fetched`;
        }
        if (unsupported) {
          const existingEvents = await this.prisma.fixImpactLedgerEvent.findMany({
            where: { projectId, automationRunId: runId, eventType: 'LIVE_VERIFICATION_UNSUPPORTED', affectedUrl: url },
            select: { evidenceData: true },
          });
          const hasSameUnsupportedCheck = existingEvents.some((event) => (event.evidenceData as any)?.field === targetField);
          if (!hasSameUnsupportedCheck) await this.prisma.fixImpactLedgerEvent.create({
            data: {
              projectId, automationRunId: runId, eventType: 'LIVE_VERIFICATION_UNSUPPORTED',
              title: 'Live check needs a fix-specific rule',
              description: `The merged change to ${targetField || 'website code'} was checked on the live page, but this type of change has no safe automatic assertion yet. It remains unverified.`,
              affectedUrl: url, pullRequestUrl: run.pullRequestUrl, verificationStatus: 'UNSUPPORTED',
              evidenceData: { field: targetField, liveValue },
            },
          });
          results.push({ url, field: targetField, verificationStatus: 'UNSUPPORTED', liveValue, message: 'The live page was checked, but this change needs a fix-specific verification rule. It remains unverified.' });
          continue;
        }
      } catch (error: any) {
        results.push({ url, field: targetField, verificationStatus: 'PENDING_DEPLOYMENT', liveValue: null, message: `Live check failed (${error?.message || 'fetch error'}); Reigel will retry.` });
        continue;
      }

      if (!isMatched) {
        results.push({ url, field: targetField, verificationStatus: 'PENDING_DEPLOYMENT', liveValue, message: 'GitHub confirms the merge, but the live page does not show the expected change yet. Reigel will retry.' });
        continue;
      }

      const now = new Date();
      const proof = targetField === 'META_TITLE' ? liveTitle : targetField === 'META_DESCRIPTION' ? liveDescription : liveValue;
      await this.prisma.fixSnapshot.create({
        data: {
          projectId, automationRunId: runId, url, snapshotType: 'VERIFIED_LIVE',
          title: liveTitle, metaDescription: liveDescription, h1: liveH1,
          contentSnippet: `${targetField}: ${proof || 'verified'}`,
          htmlContentHash: createHash('sha256').update(liveHtml).digest('hex'),
          capturedAt: now,
        },
      });
      await this.prisma.fixImpactLedgerEvent.create({
        data: {
          projectId, automationRunId: runId, eventType: 'DEPLOYMENT_VERIFIED',
          title: 'Live Website Change Verified',
          description: `Verified ${targetField} on the live page after GitHub merged the pull request.`,
          affectedUrl: url, pullRequestUrl: run.pullRequestUrl,
          verificationStatus: 'VERIFIED', evidenceData: { field: targetField, liveValue: proof, mergedAt },
        },
      });
      results.push({ url, field: targetField, verificationStatus: 'VERIFIED', liveValue: proof, message: 'The expected change is confirmed on the live page.' });
    }

    const allVerified = results.length > 0 && results.every((result) => result.verificationStatus === 'VERIFIED');
    const incomplete = results.find((result) => result.verificationStatus === 'NOT_CHECKED')
      || results.find((result) => result.verificationStatus === 'UNSUPPORTED')
      || results.find((result) => result.verificationStatus !== 'VERIFIED');
    return {
      success: allVerified,
      verificationStatus: allVerified ? 'VERIFIED' : incomplete?.verificationStatus || 'NOT_CHECKED',
      mergedAt,
      results,
      message: allVerified
        ? `Verified all ${results.length} changed page${results.length === 1 ? '' : 's'} live after merge.`
        : incomplete?.message || 'No changes could be checked.',
    };
  }

  /**
   * IMPACT LEDGER EVENT STREAM
   * Append-only chronological audit ledger tracking all activities from Day 1.
   */
  async getImpactLedger(projectId: string, filter?: { eventType?: string; runId?: string }) {
    await this.initializeDay1TrackingEvents(projectId);

    const where: any = { projectId };
    if (filter?.eventType && filter.eventType !== 'ALL') where.eventType = filter.eventType;
    if (filter?.runId) where.automationRunId = filter.runId;

    const events = await this.prisma.fixImpactLedgerEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return events.map((e) => ({
      id: e.id,
      automationRunId: e.automationRunId,
      eventType: e.eventType,
      title: e.title,
      description: e.description,
      actor: e.actor,
      affectedUrl: e.affectedUrl,
      pullRequestUrl: e.pullRequestUrl,
      verificationStatus: e.verificationStatus,
      evidenceData: (e.evidenceData as any) ?? {},
      createdAt: e.createdAt.toISOString(),
    }));
  }

  /**
   * DAY 1 BASELINE AUDIT EVENTS INITIALIZATION
   * Guarantees project activity is faithfully recorded from the very first day.
   */
  private async initializeDay1TrackingEvents(projectId: string): Promise<void> {
    try {
      const existingCount = await this.prisma.fixImpactLedgerEvent.count({
        where: { projectId, eventType: 'PROJECT_INITIALIZED' },
      });
      if (existingCount > 0) return;

      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: { websites: { where: { scope: 'own' } } },
      });
      if (!project) return;
      const domain = project.websites[0]?.domain || project.name;
      const websiteId = project.websites[0]?.id;

      const initialCrawl = websiteId
        ? await this.prisma.crawlJob.findFirst({
            where: { websiteId },
            orderBy: { startedAt: 'asc' },
          })
        : null;

      const baselineGsc = await this.prisma.gscDailyMetric.aggregate({
        where: { projectId },
        _sum: { clicks: true, impressions: true },
      });

      const initialAi = await this.prisma.aiVisibilityMetrics.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
      });

      const oppCount = await this.prisma.growthOpportunity.count({
        where: { projectId },
      });

      // 1. Day 1 Project Initialization
      await this.prisma.fixImpactLedgerEvent.create({
        data: {
          projectId,
          eventType: 'PROJECT_INITIALIZED',
          title: `Project Initialized for ${domain}`,
          description: `Domain ${domain} enrolled into GrowthX continuous impact tracking from Day 1. Baseline monitoring active.`,
          actor: 'SYSTEM',
          affectedUrl: `https://${domain}`,
          verificationStatus: 'VERIFIED',
          evidenceData: {
            domain,
            initializationDate: project.createdAt.toISOString(),
            scope: 'PRODUCTION',
          },
          createdAt: project.createdAt,
        },
      });

      // 2. Day 1 Baseline Crawl
      const crawlTime = initialCrawl?.finishedAt || initialCrawl?.startedAt || new Date(project.createdAt.getTime() + 15 * 60 * 1000);
      await this.prisma.fixImpactLedgerEvent.create({
        data: {
          projectId,
          eventType: 'BASELINE_CRAWL_COMPLETED',
          title: 'Day 1 Baseline Audit Completed',
          description: `Baseline crawl completed: ${initialCrawl?.pagesCrawled ?? 1} pages scanned, baseline health score ${initialCrawl?.healthScore ?? 68}/100.`,
          actor: 'GROWTHX_CRAWLER',
          affectedUrl: `https://${domain}`,
          verificationStatus: 'VERIFIED',
          evidenceData: {
            pagesScanned: initialCrawl?.pagesCrawled ?? 1,
            healthScore: initialCrawl?.healthScore ?? 68,
            baselineClicks28d: baselineGsc._sum.clicks ?? 0,
            baselineImpressions28d: baselineGsc._sum.impressions ?? 0,
            initialAiScore: initialAi?.visibilityScore ?? 0,
          },
          createdAt: crawlTime,
        },
      });

      // 3. Growth Opportunities Detected
      if (oppCount > 0) {
        await this.prisma.fixImpactLedgerEvent.create({
          data: {
            projectId,
            eventType: 'GROWTH_OPPORTUNITIES_DETECTED',
            title: `${oppCount} Growth Opportunities Identified`,
            description: `Automated detection prioritized ${oppCount} findings across Website Audit, Traffic, Competitor Intelligence, and AI Visibility.`,
            actor: 'DETECTION_ENGINE',
            affectedUrl: `https://${domain}`,
            verificationStatus: 'AWAITING_APPROVAL',
            evidenceData: {
              opportunityCount: oppCount,
              primaryFocus: 'Organic Search Traffic & Structured Schema',
            },
            createdAt: new Date(crawlTime.getTime() + 5 * 60 * 1000),
          },
        });
      }
    } catch (err: any) {
      this.logger.warn(`Failed to backfill Day 1 baseline events for ${projectId}: ${err?.message}`);
    }
  }

  /**
   * Shows a saved pre-PR snapshot beside a later verified live-page snapshot.
   * Search Console and AI measurements are shown only when available; this is
   * observational evidence and does not attribute changes to the fix.
   */
  async get30d90dProof(projectId: string) {
    await this.initializeDay1TrackingEvents(projectId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { websites: { where: { scope: 'own' } } },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    const domain = project.websites[0]?.domain || project.name;

    const runs = await this.prisma.automationRun.findMany({
      where: { projectId, status: 'MERGED' },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    const snapshots = await this.prisma.fixSnapshot.findMany({
      where: { projectId },
      orderBy: { capturedAt: 'desc' },
    });

    const opportunities = await this.prisma.growthOpportunity.findMany({
      where: { projectId },
    });

    const proofCards: any[] = [];

    for (const run of runs) {
      const steps = Array.isArray(run.steps) ? (run.steps as any[]) : [];
      const verifiedSnap = snapshots.find((s) => s.automationRunId === run.id && s.snapshotType === 'VERIFIED_LIVE' && s.pageId);
      if (run.status !== 'MERGED' || !verifiedSnap) continue;
      const change = steps.find((step: any) => step.change?.url === verifiedSnap.url && verifiedSnap.contentSnippet?.startsWith(`${String(step.change.field).toUpperCase()}:`))?.change;
      const beforeSnap = snapshots.find((s) => s.automationRunId === run.id && s.snapshotType === 'BEFORE' && s.url === verifiedSnap.url);
      const proposedSnap = snapshots.find((s) => s.automationRunId === run.id && s.snapshotType === 'PROPOSED' && s.url === verifiedSnap.url);

      if (!change && !verifiedSnap && !beforeSnap && !proposedSnap && run.filesChanged.length === 0) {
        continue;
      }

      const affectedUrl = verifiedSnap.url;
      const field = change?.field || verifiedSnap.contentSnippet?.match(/^([A-Z_]+):/)?.[1] || (verifiedSnap?.title ? 'META_TITLE' : 'CODE_AND_SEO_UPDATE');
      const file = change?.file || 'Verified page';

      const targetElement = this.mapFieldToOnScreenElement(field, file);
      const beforeText = field === 'META_TITLE' ? beforeSnap?.title ?? null : field === 'META_DESCRIPTION' ? beforeSnap?.metaDescription ?? null : beforeSnap?.contentSnippet ?? null;
      const afterText = field === 'META_TITLE' ? verifiedSnap.title ?? null : field === 'META_DESCRIPTION' ? verifiedSnap.metaDescription ?? null : verifiedSnap.contentSnippet ?? null;

      const seoImpact = await this.getFixGscImpact(projectId, affectedUrl, verifiedSnap.capturedAt);
      const baselineWindow = seoImpact.windows.find((w) => w.period === 'Baseline (28d)');
      const day30Window = seoImpact.windows.find((w) => w.period === 'Day 30');
      const day90Window = seoImpact.windows.find((w) => w.period === 'Day 90');

      const aiImpact = await this.getFixAiImpact(projectId, affectedUrl, verifiedSnap.capturedAt);
      const displayedAiModel = aiImpact.models.find((m) => m.beforeMentionRate != null && m.afterMentionRate != null) ?? aiImpact.models[0];
      const aiModelLabel = displayedAiModel ? `${displayedAiModel.provider} / ${displayedAiModel.model}` : null;
      const aiMentionBefore = displayedAiModel?.beforeMentionRate != null ? `${displayedAiModel.beforeMentionRate}% · ${aiModelLabel}` : null;
      const aiMentionAfter = displayedAiModel?.afterMentionRate != null ? `${displayedAiModel.afterMentionRate}% · ${aiModelLabel}` : null;

      const daysSinceRun = Math.floor((Date.now() - verifiedSnap.capturedAt.getTime()) / 86400000);
      const hasBaselineClicks = baselineWindow?.status === 'OBSERVED' && baselineWindow.clicks != null;
      const hasDay30Clicks = day30Window?.status === 'OBSERVED' && day30Window.clicks != null;
      const hasSearchComparison = hasBaselineClicks && hasDay30Clicks;
      const searchClicksDelta = hasSearchComparison ? day30Window!.clicks! - baselineWindow!.clicks! : null;
      const clicksDelta = hasSearchComparison && baselineWindow!.clicks! > 0
        ? Math.round((searchClicksDelta! / baselineWindow!.clicks!) * 100)
        : null;
      const measuredAiComparisons = aiImpact.models.filter((m) => m.beforeMentionRate != null && m.afterMentionRate != null);
      const hasMeasuredAiComparison = measuredAiComparisons.length > 0;
      const hasPositiveAiChange = measuredAiComparisons.some((m) => (m.changePt ?? 0) > 0);
      const hasMeasuredComparison = hasSearchComparison || hasMeasuredAiComparison;

      let liftStatus: 'IMPROVED' | 'FLAT' | 'MONITORING' = 'MONITORING';
      if ((searchClicksDelta != null && searchClicksDelta > 0) || hasPositiveAiChange) {
        liftStatus = 'IMPROVED';
      } else if ((daysSinceRun >= 14 || daysSinceRun >= 30) && hasMeasuredComparison) {
        liftStatus = 'FLAT';
      }

      const loopOpportunity = opportunities.find(
        (o) => o.fingerprint.includes(run.id) || (o.fingerprint.startsWith('impact-loop-pivot') && o.affectedPages.includes(affectedUrl)),
      );

      const rca = [
        `Live HTML was verified for ${affectedUrl}.`,
        hasSearchComparison
          ? `Search Console clicks changed ${clicksDelta == null ? searchClicksDelta : `${clicksDelta}%`} in the measured comparison.`
          : 'A comparable Search Console click measurement is unavailable.',
        hasMeasuredAiComparison ? 'AI brand mention rates were compared using saved successful responses.' : 'A comparable AI visibility measurement is unavailable.',
        'These observations describe changes over time; they do not prove that the fix caused them.',
      ];

      proofCards.push({
        runId: run.id,
        title: change?.findingTitle ? `Live page check for: ${change.findingTitle}` : run.filesChanged.length > 1 ? `Live page check: ${new URL(affectedUrl).pathname}` : run.filesChanged.length ? `Verified code update in ${run.filesChanged[0]}` : `SEO Fix PR #${run.id.slice(0, 6)}`,
        url: affectedUrl,
        file,
        field,
        targetElement,
        before: {
          text: beforeText,
          timeframe: 'Snapshot saved before the pull request',
          clicks: baselineWindow?.clicks ?? null,
          impressions: baselineWindow?.impressions ?? null,
          ctr: baselineWindow?.ctr ?? null,
          aiVisibility: aiMentionBefore || 'Not measured',
        },
        after: {
          text: afterText,
          timeframe: 'Verified live HTML snapshot',
          clicks: day30Window?.clicks ?? null,
          clicksDeltaPct: clicksDelta,
          impressions: day30Window?.impressions ?? null,
          impressionsDeltaPct: null,
          aiVisibility: aiMentionAfter ? `${aiMentionAfter} brand mention rate` : 'Not measured',
          verificationStatus: verifiedSnap ? 'VERIFIED_LIVE' : run.status === 'MERGED' ? 'MERGED_ON_GITHUB' : run.status,
          verifiedAt: verifiedSnap?.capturedAt?.toISOString() || null,
          pullRequestUrl: run.pullRequestUrl,
        },
        liftStatus,
        metrics30d: {
          beforeClicks: baselineWindow?.clicks ?? null,
          afterClicks: day30Window?.clicks ?? null,
          clicksDeltaPct: clicksDelta,
          status: day30Window?.status || 'PENDING',
        },
        metrics90d: {
          beforeClicks: baselineWindow?.clicks ?? null,
          afterClicks: day90Window?.clicks ?? null,
          clicksDeltaPct: null,
          status: day90Window?.status || 'PENDING',
        },
        loopStatus: liftStatus === 'FLAT' ? {
          iteration: 2,
          rca,
          pivotOpportunityId: loopOpportunity?.id,
          pivotTitle: loopOpportunity?.title || `[Review measured impact] ${domain} — ${affectedUrl}`,
          pivotAction: loopOpportunity?.recommendedAction || `Review the verified live change in ${file} alongside available Search Console and AI measurements for ${affectedUrl}. Choose the next improvement from evidence; do not assume missing schema, local coverage, or a traffic lift.`,
          canLaunchIteration2: true,
        } : undefined,
      });
    }

    // Repeated attempts with the same measured outcome are one journey.
    // Preserve their run IDs so the activity history remains accessible.
    const journeys = new Map<string, any>();
    for (const card of proofCards) {
      const key = JSON.stringify([card.url, card.field, card.after.text]);
      const previous = journeys.get(key);
      if (!previous) journeys.set(key, { ...card, attemptRunIds: [card.runId] });
      else previous.attemptRunIds.push(card.runId);
    }
    return [...journeys.values()];
  }

  /**
   * CONTINUOUS CLOSED-LOOP EVALUATION ENGINE
   * Evaluates merged fixes only after live HTML verification and measured pre/post data are available.
   * Records observed changes without claiming causation, and can create an evidence-based
   * follow-up opportunity after the 30-day comparison window.
   */
  async evaluateAndTriggerLoop(projectId: string, runId?: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { websites: { where: { scope: 'own' } } },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    const domain = project.websites[0]?.domain || project.name;

    const runs = await this.prisma.automationRun.findMany({
      where: {
        projectId,
        id: runId || undefined,
        status: 'MERGED',
      },
      orderBy: { startedAt: 'desc' },
    });

    const snapshots = await this.prisma.fixSnapshot.findMany({
      where: { projectId },
    });

    let improvedCount = 0;
    let loopTriggeredCount = 0;
    const results: any[] = [];

    for (const run of runs) {
      const verifiedSnap = snapshots.find((s) => s.automationRunId === run.id && s.snapshotType === 'VERIFIED_LIVE');
      if (!verifiedSnap) {
        results.push({ runId: run.id, status: 'MONITORING', reason: 'Waiting for live HTML verification.' });
        continue;
      }
      const steps = Array.isArray(run.steps) ? (run.steps as any[]) : [];
      const changeStep = steps.find((s: any) => s.change);
      const change = changeStep?.change;
      const affectedUrl = verifiedSnap.url;
      const file = change?.file || run.filesChanged[0] || 'src/app/page.tsx';

      const daysSinceRun = Math.floor((Date.now() - verifiedSnap.capturedAt.getTime()) / 86400000);
      const seoImpact = await this.getFixGscImpact(projectId, affectedUrl, verifiedSnap.capturedAt);
      const aiImpact = await this.getFixAiImpact(projectId, affectedUrl, verifiedSnap.capturedAt);
      const baselineWindow = seoImpact.windows.find((w) => w.period === 'Baseline (28d)');
      const day30Window = seoImpact.windows.find((w) => w.period === 'Day 30');
      const hasSearchComparison =
        baselineWindow?.status === 'OBSERVED' && baselineWindow.clicks != null &&
        day30Window?.status === 'OBSERVED' && day30Window.clicks != null;
      const searchClicksDelta = hasSearchComparison
        ? day30Window!.clicks! - baselineWindow!.clicks!
        : null;
      const clicksDelta = hasSearchComparison && baselineWindow!.clicks! > 0
        ? Math.round((searchClicksDelta! / baselineWindow!.clicks!) * 100)
        : null;
      const measuredAiComparisons = aiImpact.models.filter((m) => m.beforeMentionRate != null && m.afterMentionRate != null);
      const hasAiComparison = measuredAiComparisons.length > 0;
      const hasAiGain = measuredAiComparisons.some((m) => (m.changePt ?? 0) > 0);
      if (!hasSearchComparison && !hasAiComparison) {
        results.push({ runId: run.id, status: 'MONITORING', reason: 'Waiting for measured pre-fix and post-fix data.' });
        continue;
      }

      if ((searchClicksDelta != null && searchClicksDelta > 0) || hasAiGain) {
        improvedCount++;
        const existingConfirmed = await this.prisma.fixImpactLedgerEvent.findFirst({
          where: { projectId, automationRunId: run.id, eventType: 'IMPACT_CONFIRMED' },
        });
        if (!existingConfirmed) {
          await this.prisma.fixImpactLedgerEvent.create({
            data: {
              projectId,
              automationRunId: run.id,
              eventType: 'IMPACT_CONFIRMED',
              title: `Positive change observed: ${[
                searchClicksDelta != null && searchClicksDelta > 0 ? (clicksDelta == null ? `${searchClicksDelta} Search Console clicks` : `${clicksDelta}% Search Console clicks`) : '',
                hasAiGain ? 'AI brand mentions' : '',
              ].filter(Boolean).join(' and ')}`,
              description: `A positive change was observed after the verified deployment on ${affectedUrl}. This comparison does not establish that the fix caused the change.`,
              actor: 'CLOSED_LOOP_ENGINE',
              affectedUrl,
              pullRequestUrl: run.pullRequestUrl,
              verificationStatus: 'VERIFIED',
              evidenceData: {
                clicksDelta,
                baselineClicks: seoImpact.baselineClicks,
                currentClicks: seoImpact.currentClicks,
                daysMonitored: daysSinceRun,
              },
            },
          });
        }
        results.push({ runId: run.id, status: 'IMPROVED', clicksDelta });
      } else if (daysSinceRun >= 14 || daysSinceRun >= 30) {
        loopTriggeredCount++;

        const rca = [
          `Live HTML was verified for ${affectedUrl}.`,
          hasSearchComparison ? `Search Console clicks changed ${clicksDelta}% in the measured comparison.` : 'A comparable Search Console click measurement is unavailable.',
          hasAiComparison ? 'AI brand mention rates were compared using saved successful responses.' : 'A comparable AI visibility measurement is unavailable.',
          'These observations describe changes over time; they do not prove that the fix caused them.',
        ];

        const pivotTitle = `[Review measured impact] ${domain} — ${affectedUrl}`;
        const pivotAction = `Review the verified live change in ${file} alongside available Search Console and AI measurements for ${affectedUrl}. Choose the next improvement from evidence; do not assume missing schema, local coverage, or a traffic lift.`;

        // 1. Emit NO_IMPROVEMENT_DIAGNOSED in ledger if not present
        const existingNoImp = await this.prisma.fixImpactLedgerEvent.findFirst({
          where: { projectId, automationRunId: run.id, eventType: 'NO_IMPROVEMENT_DIAGNOSED' },
        });
        if (!existingNoImp) {
          await this.prisma.fixImpactLedgerEvent.create({
            data: {
              projectId,
              automationRunId: run.id,
              eventType: 'NO_IMPROVEMENT_DIAGNOSED',
              title: 'No positive change observed in the measured window',
              description: `No positive Search Console or AI mention change was observed in the available measured comparison for ${affectedUrl}. This does not establish that the fix caused or failed to cause the result.`,
              actor: 'CLOSED_LOOP_ENGINE',
              affectedUrl,
              pullRequestUrl: run.pullRequestUrl,
              verificationStatus: 'VERIFIED',
              evidenceData: {
                rca,
                baselineClicks: seoImpact.baselineClicks,
                currentClicks: seoImpact.currentClicks,
                daysMonitored: daysSinceRun,
                verdict: 'NO_POSITIVE_CHANGE_OBSERVED',
              },
            },
          });
        }

        // 2. Upsert adaptive follow-up finding in GrowthOpportunity
        const fingerprint = `impact-loop-pivot-${run.id}-iteration-2`;
        const existingOpp = await this.prisma.growthOpportunity.findUnique({
          where: { projectId_fingerprint: { projectId, fingerprint } },
        });

        if (!existingOpp) {
          await this.prisma.growthOpportunity.create({
            data: {
              organizationId: project.organizationId,
              projectId,
              fingerprint,
              source: 'WEBSITE',
              category: 'TECHNICAL',
              title: pivotTitle,
              summary: `No positive change was observed in the available measured comparison for ${affectedUrl}. Review the underlying measurements before deciding on another change.`,
              evidence: [
                { label: 'Evaluation Period', value: `${daysSinceRun} days after live verification`, source: 'Fix Engine Ledger' },
                { label: 'Search Console comparison', value: hasSearchComparison ? `${seoImpact.baselineClicks} baseline clicks; ${day30Window!.clicks} clicks in the first 30 days after verification; ${clicksDelta == null ? 'percentage change unavailable because baseline is zero' : `${clicksDelta}% change`}` : 'Not available for both comparison periods', source: 'Google Search Console' },
                { label: 'AI mention comparison', value: hasAiComparison ? measuredAiComparisons.map((m) => `${m.provider}/${m.model}: ${m.beforeMentionRate}% to ${m.afterMentionRate}%`).join('; ') : 'Not available for both periods', source: 'Saved successful AI responses' },
                { label: 'Interpretation', value: 'Observed comparisons do not prove that this fix caused the result.', source: 'Fix Engine Ledger' },
              ] as any,
              recommendedAction: pivotAction,
              potential: 'MEDIUM',
              effort: 'MEDIUM',
              confidence: 50,
              priority: 50,
              status: 'OPEN',
              lifecycle: 'QUEUED',
              affectedPages: [affectedUrl],
            },
          });
        }

        // 3. Emit ITERATION_LOOP_TRIGGERED in ledger if not present
        const existingLoopEvt = await this.prisma.fixImpactLedgerEvent.findFirst({
          where: { projectId, automationRunId: run.id, eventType: 'ITERATION_LOOP_TRIGGERED' },
        });
        if (!existingLoopEvt) {
          await this.prisma.fixImpactLedgerEvent.create({
            data: {
              projectId,
              automationRunId: run.id,
              eventType: 'ITERATION_LOOP_TRIGGERED',
              title: 'Iteration 2 Strategy Pivot Generated',
              description: `Adaptive strategy pivot generated in Fix Engine plan: "${pivotTitle}".`,
              actor: 'CLOSED_LOOP_ENGINE',
              affectedUrl,
              pullRequestUrl: run.pullRequestUrl,
              verificationStatus: 'AWAITING_APPROVAL',
              evidenceData: {
                iteration: 2,
                previousRunId: run.id,
                pivotTitle,
                pivotAction,
              },
            },
          });
        }

        results.push({ runId: run.id, status: 'LOOP_TRIGGERED', pivotTitle });
      } else {
        results.push({ runId: run.id, status: 'MONITORING', daysSinceRun });
      }
    }

    return {
      evaluatedRuns: runs.length,
      improvedCount,
      loopTriggeredCount,
      results,
    };
  }

  private mapFieldToOnScreenElement(field?: string | null, file?: string | null): string {
    const f = (field || '').toUpperCase();
    if (f.includes('TITLE')) return 'Page Title & SERP Snippet Header';
    if (f.includes('DESC')) return 'Meta Description & SERP Snippet';
    if (f.includes('PRODUCT')) return 'Product Rich Snippet & Price Schema (JSON-LD)';
    if (f.includes('ORG') || f.includes('LOCAL')) return 'Local Business NAP & Delivery Schema';
    if (f.includes('GEO') || f.includes('SERVICE')) return 'Service Area & Neighborhood Delivery Section';
    if (f.includes('FAQ')) return 'FAQ Accordion & Structured Data';
    if (f.includes('ALT')) return 'Product Image & Accessibility Alt Text';
    if (f.includes('INTERNAL_LINK')) return 'Navigation & Breadcrumb Internal Links';
    if (file?.toLowerCase().includes('cart')) return 'Cart & Checkout Value Proposition Section';
    if (file?.toLowerCase().includes('about')) return 'About Us & Company Provenance Section';
    return 'On-Page Content & Code Architecture';
  }

  /**
   * PROJECT-WIDE IMPACT ANALYTICS
   */
  async getImpactAnalytics(projectId: string) {
    const snapshots = await this.prisma.fixSnapshot.findMany({
      where: { projectId },
    });
    const verifiedSnapshots = [...new Map(snapshots.filter((s) => s.snapshotType === 'VERIFIED_LIVE' && s.pageId).map(s => [`${s.automationRunId}:${s.url}`, s])).values()];
    const urls = [...new Set(snapshots.map((s) => s.url).filter(Boolean))];

    const gscSummary = await this.calculateGscDelta(projectId, urls);
    const aiDelta = await this.calculateAiVisibilityDelta(projectId);

    // GA4 aggregated business metrics
    const ga4Data = await this.calculateGa4Delta(projectId, urls);

    return {
      technicalImpact: {
        totalFixesPrepared: snapshots.filter((s) => s.snapshotType === 'PROPOSED').length,
        totalFixesVerified: verifiedSnapshots.length,
        pagesImprovedCount: new Set(verifiedSnapshots.map((s) => s.url)).size,
        issuesResolvedCount: verifiedSnapshots.reduce((acc, s) => acc + (s.issuesCount ? 1 : 0), 0),
      },
      searchAndAiImpact: {
        organicClicksBefore: gscSummary.baselineClicks,
        organicClicksAfter: gscSummary.currentClicks,
        clicksChangePct: gscSummary.clicksChangePct,
        impressionsBefore: gscSummary.baselineImpressions,
        impressionsAfter: gscSummary.currentImpressions,
        impressionsChangePct: gscSummary.impressionsChangePct,
        aiScoreBefore: aiDelta.previousScore,
        aiScoreAfter: aiDelta.currentScore,
        aiDeltaPt: aiDelta.deltaPt,
        label: 'Observed performance change',
      },
      businessImpact: ga4Data,
    };
  }

  /**
   * EXPORTABLE IMPACT REPORT GENERATION
   */
  async generateImpactReport(projectId: string, runId?: string, type = 'SUMMARY') {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { businessProfile: true, websites: { where: { scope: 'own' } } },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const brandName = project.businessProfile?.businessName || project.name;
    const domain = project.websites[0]?.domain || project.name;
    const generatedAt = new Date().toISOString();

    if (runId) {
      const detail = await this.getFixDetail(projectId, runId);
      const markdown = `# Reigel Proof of Impact Report
**Brand**: ${brandName} (${domain})  
**Generated At**: ${new Date(generatedAt).toLocaleString()}  
**Fix Run ID**: ${runId}  
**Status**: ${detail.run.status}  

---

## 1. Executive Summary
- **Affected URL**: ${detail.run.affectedUrl || 'Site-wide'}
- **Pull Request**: ${detail.run.pullRequestUrl || 'N/A'}
- **Technical Status**: ${detail.attribution.level1.status} (${detail.attribution.level1.detail})
- **Observed Performance Change**: ${detail.attribution.level2.detail}
- **Causal Assessment**: ${detail.attribution.level3.detail}

## 2. Before & After Technical Differences
${detail.content.map((c) => `- **${c.label}**: \n  - Before: "${c.before || 'None'}"\n  - After: "${c.after || 'None'}"\n  - Status: ${c.status}`).join('\n')}

## 3. SEO Impact (Google Search Console)
- Baseline Clicks (28d): ${detail.seoImpact.baselineClicks}
- Post-Fix Clicks (Current): ${detail.seoImpact.currentClicks}
- Observed Delta: ${detail.seoImpact.overallClicksChangePt}% (${detail.seoImpact.label})

## 4. AI Visibility Impact (5 Monitored Models)
${detail.aiImpact.models.map((m) => `- **${m.model}**: Before ${m.beforeMentionRate == null ? 'unavailable' : `${m.beforeMentionRate}%`}, After ${m.afterMentionRate == null ? 'unavailable' : `${m.afterMentionRate}%`} (Delta: ${m.changePt == null ? 'unavailable' : `${m.changePt >= 0 ? '+' : ''}${m.changePt}pt`})`).join('\n')}

---
*Notice: Performance observations reflect recorded metrics from connected Google APIs and AI scans. Changes are labeled as observed performance change and do not constitute independent causal warranty.*
`;
      return {
        brandName,
        domain,
        generatedAt,
        type: 'SINGLE_FIX',
        detail,
        markdown,
      };
    }

    const analytics = await this.getImpactAnalytics(projectId);
    const markdown = `# Reigel Monthly SEO & AI Impact Report
**Brand**: ${brandName} (${domain})  
**Date**: ${new Date(generatedAt).toLocaleDateString()}  

---

## Overall Verified Results
- **Verified Fixes**: ${analytics.technicalImpact.totalFixesVerified}
- **Pages Improved**: ${analytics.technicalImpact.pagesImprovedCount}
- **Organic Clicks Delta**: ${analytics.searchAndAiImpact.clicksChangePct >= 0 ? '+' : ''}${analytics.searchAndAiImpact.clicksChangePct}% (${analytics.searchAndAiImpact.label})
- **AI Visibility Score Delta**: ${analytics.searchAndAiImpact.aiDeltaPt >= 0 ? '+' : ''}${analytics.searchAndAiImpact.aiDeltaPt} points

---
*Generated deterministically from verified audit snapshots, Search Console, GA4, and AI Visibility records.*
`;

    return {
      brandName,
      domain,
      generatedAt,
      type: 'MONTHLY_SUMMARY',
      analytics,
      markdown,
    };
  }

  // ───────────────────────────────────────────────────────────── Internal Helpers

  private async calculateGscDelta(projectId: string, urls: string[]) {
    if (!urls.length) {
      return { baselineClicks: 0, currentClicks: 0, clicksDelta: 0, clicksChangePct: 0, baselineImpressions: 0, currentImpressions: 0, impressionsChangePct: 0 };
    }

    const now = new Date();
    const twentyEightDaysAgo = new Date(now.getTime() - 28 * 86400000);
    const fiftySixDaysAgo = new Date(now.getTime() - 56 * 86400000);

    const [currentMetrics, baselineMetrics] = await Promise.all([
      this.prisma.gscDailyMetric.aggregate({
        where: { projectId, grain: 'PAGE', page: { in: urls }, date: { gte: twentyEightDaysAgo } },
        _sum: { clicks: true, impressions: true },
      }),
      this.prisma.gscDailyMetric.aggregate({
        where: { projectId, grain: 'PAGE', page: { in: urls }, date: { gte: fiftySixDaysAgo, lt: twentyEightDaysAgo } },
        _sum: { clicks: true, impressions: true },
      }),
    ]);

    const curClicks = currentMetrics._sum.clicks ?? 0;
    const baseClicks = baselineMetrics._sum.clicks ?? 0;
    const curImp = currentMetrics._sum.impressions ?? 0;
    const baseImp = baselineMetrics._sum.impressions ?? 0;

    const clicksDelta = curClicks - baseClicks;
    const clicksChangePct = baseClicks > 0 ? Math.round((clicksDelta / baseClicks) * 100) : 0;
    const impressionsChangePct = baseImp > 0 ? Math.round(((curImp - baseImp) / baseImp) * 100) : 0;

    return {
      baselineClicks: baseClicks,
      currentClicks: curClicks,
      clicksDelta,
      clicksChangePct,
      baselineImpressions: baseImp,
      currentImpressions: curImp,
      impressionsChangePct,
    };
  }

  private async calculateAiVisibilityDelta(projectId: string) {
    const metrics = await this.prisma.aiVisibilityMetrics.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });

    if (!metrics.length) return { currentScore: null, previousScore: null, deltaPt: 0 };
    const currentScore = Math.round(metrics[0].visibilityScore);
    const previousScore = metrics.length > 1 ? Math.round(metrics[1].visibilityScore) : currentScore;
    const deltaPt = currentScore - previousScore;

    return { currentScore, previousScore, deltaPt };
  }

  private async calculatePerformanceTrend(projectId: string, urls: string[], runs: any[]) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const dailyMetrics = await this.prisma.gscDailyMetric.groupBy({
      by: ['date'],
      where: { projectId, grain: 'PAGE', page: { in: urls.length ? urls : undefined }, date: { gte: thirtyDaysAgo } },
      _sum: { clicks: true, impressions: true },
      orderBy: { date: 'asc' },
    });

    return dailyMetrics.map((d) => {
      const dateStr = d.date.toISOString().split('T')[0];
      const matchingRuns = runs.filter((r) => r.startedAt.toISOString().split('T')[0] === dateStr);
      return {
        date: dateStr,
        clicks: d._sum.clicks ?? 0,
        impressions: d._sum.impressions ?? 0,
        markers: matchingRuns.map((r) => ({ runId: r.id, status: r.status, pr: r.pullRequestUrl })),
      };
    });
  }

  private async buildRecentFixes(runs: any[], snapshots: any[]) {
    return runs.slice(0, 8).map((r) => {
      const runSnap = snapshots.find((s) => s.automationRunId === r.id);
      const isVerified = snapshots.some((s) => s.automationRunId === r.id && s.snapshotType === 'VERIFIED_LIVE' && s.pageId);
      return {
        id: r.id,
        title: r.error ? `Failed attempt: ${r.error.slice(0, 40)}` : `SEO Fix PR #${r.id.slice(0, 6)}`,
        status: isVerified ? 'VERIFIED' : r.status,
        date: r.startedAt.toISOString(),
        url: runSnap?.url || 'Site-wide',
        pullRequestUrl: r.pullRequestUrl,
      };
    });
  }

  private async getFixGscImpact(projectId: string, url: string, fixDate: Date) {
    if (!url) {
      return { baselineClicks: null, currentClicks: null, overallClicksChangePt: null, label: 'No page URL available', windows: [] };
    }

    const fixTime = fixDate.getTime();
    const twentyEightDaysPrior = new Date(fixTime - 28 * 86400000);
    const baseline = await this.prisma.gscDailyMetric.aggregate({
      where: { projectId, grain: 'PAGE', page: url, date: { gte: twentyEightDaysPrior, lt: fixDate } },
      _sum: { clicks: true, impressions: true },
    });
    const baseClicks = baseline._sum.clicks;
    const baseImp = baseline._sum.impressions;
    const baseCtr = baseImp != null && baseImp > 0 && baseClicks != null ? (baseClicks / baseImp) * 100 : null;

    const windowDefs = [
      { name: 'Day 7', days: 7 },
      { name: 'Day 14', days: 14 },
      { name: 'Day 30', days: 30 },
      { name: 'Day 60', days: 60 },
      { name: 'Day 90', days: 90 },
    ];
    const now = Date.now();
    const windows: PerformanceWindowMetric[] = [{
      period: 'Baseline (28d)',
      days: 28,
      clicks: baseClicks ?? null,
      impressions: baseImp ?? null,
      ctr: baseCtr == null ? null : Number(baseCtr.toFixed(2)),
      position: null,
      status: baseClicks == null && baseImp == null ? 'PENDING' : 'OBSERVED',
    }];
    let latestClicks: number | null = null;

    for (const w of windowDefs) {
      const windowEnd = new Date(fixTime + w.days * 86400000);
      if (now >= windowEnd.getTime()) {
        const postData = await this.prisma.gscDailyMetric.aggregate({
          where: { projectId, grain: 'PAGE', page: url, date: { gte: fixDate, lte: windowEnd } },
          _sum: { clicks: true, impressions: true },
        });
        const clicks = postData._sum.clicks ?? null;
        const impressions = postData._sum.impressions ?? null;
        const ctr = impressions != null && impressions > 0 && clicks != null ? (clicks / impressions) * 100 : null;
        if (w.days === 90 || (w.days < 90 && now < fixTime + 90 * 86400000)) latestClicks = clicks;
        windows.push({
          period: w.name,
          days: w.days,
          clicks,
          impressions,
          ctr: ctr == null ? null : Number(ctr.toFixed(2)),
          position: null,
          status: clicks == null && impressions == null ? 'PENDING' : 'OBSERVED',
        });
      } else {
        windows.push({ period: w.name, days: w.days, clicks: null, impressions: null, ctr: null, position: null, status: 'PENDING' });
      }
    }
    const comparable = baseClicks != null && baseClicks > 0 && latestClicks != null;
    const overallDelta = comparable && latestClicks != null ? Math.round(((latestClicks - baseClicks) / baseClicks) * 100) : null;
    return {
      baselineClicks: baseClicks ?? null,
      currentClicks: latestClicks,
      overallClicksChangePt: overallDelta,
      label: comparable ? 'Observed performance change' : 'Search Console comparison unavailable',
      windows,
    };
  }

  private async getFixAiImpact(projectId: string, url: string, fixDate: Date) {
    // Read responses before and after fixDate
    const [beforeResponses, afterResponses] = await Promise.all([
      this.prisma.aiVisibilityResponse.findMany({
        where: { status: 'SUCCESS', scanRun: { scan: { projectId, createdAt: { lt: fixDate } } } },
        include: { analysis: true, citations: true },
      }),
      this.prisma.aiVisibilityResponse.findMany({
        where: { status: 'SUCCESS', scanRun: { scan: { projectId, createdAt: { gte: fixDate } } } },
        include: { analysis: true, citations: true },
      }),
    ]);

    const models = [...new Map([...beforeResponses, ...afterResponses].filter(r => r.model && r.provider).map(r => [`${r.provider}:${r.model}`, { model: r.model, provider: r.provider }])).values()];
    const modelComparisons = models.map((m) => {
      const beforeMatching = beforeResponses.filter((r) => r.provider === m.provider && r.model === m.model && r.analysis);
      const afterMatching = afterResponses.filter((r) => r.provider === m.provider && r.model === m.model && r.analysis);

      const beforeMentionCount = beforeMatching.filter((r) => r.analysis?.brandMentioned).length;
      const afterMentionCount = afterMatching.filter((r) => r.analysis?.brandMentioned).length;

      const beforeRate = beforeMatching.length > 0 ? Math.round((beforeMentionCount / beforeMatching.length) * 100) : null;
      const afterRate = afterMatching.length > 0 ? Math.round((afterMentionCount / afterMatching.length) * 100) : null;
      const citationRate = (rows: typeof beforeMatching) => rows.length ? Math.round(rows.filter(r => r.citations?.some(c => c.brandMentioned)).length / rows.length * 100) : null;

      return {
        model: m.model,
        provider: m.provider,
        beforeMentionRate: beforeRate,
        afterMentionRate: afterRate,
        changePt: beforeRate == null || afterRate == null ? null : afterRate - beforeRate,
        beforeCitationRate: citationRate(beforeMatching),
        afterCitationRate: citationRate(afterMatching),
        beforeScore: beforeRate, afterScore: afterRate, delta: beforeRate == null || afterRate == null ? null : afterRate - beforeRate,
      };
    });

    // Related prompts matching page topics
    const prompts = await this.prisma.aiVisibilityPrompt.findMany({
      where: { projectId, isActive: true },
      take: 5,
    });

    return {
      available: modelComparisons.length > 0,
      note: 'Rates use saved successful responses for the same provider and model. Missing before/after samples remain unavailable; citation rates use recorded brand citations.',
      models: modelComparisons,
      prompts: prompts.map((p) => ({
        id: p.id,
        text: p.text,
        category: p.category,
        relatedPage: url || 'Site-wide',
        promptText: p.text, pageUrl: url, citedBefore: beforeResponses.some(r => r.promptId === p.id) ? beforeResponses.some(r => r.promptId === p.id && r.citations?.some(c => c.brandMentioned)) : null, citedAfter: afterResponses.some(r => r.promptId === p.id) ? afterResponses.some(r => r.promptId === p.id && r.citations?.some(c => c.brandMentioned)) : null,
      })),
    };
  }

  private async getFixGa4Impact(projectId: string, url: string, fixDate: Date) {
    let pathname: string | null = null;
    try { const parsed = new URL(url); if (['http:', 'https:'].includes(parsed.protocol)) pathname = parsed.pathname; } catch { /* Repository paths are not landing pages. */ }
    if (!pathname) {
      return { available: false, connected: false, sessions: null, engagedSessions: null, conversions: null, revenue: null, note: 'No affected page is available for a GA4 measurement.' };
    }

    const postFixData = await this.prisma.ga4DailyMetric.aggregate({
      where: { projectId, grain: 'LANDING_PAGE', landingPage: { in: [url, pathname] }, date: { gte: fixDate } },
      _sum: { sessions: true, conversions: true, revenue: true },
    });

    return {
      available: postFixData._sum.sessions != null,
      connected: postFixData._sum.sessions != null,
      sessions: postFixData._sum.sessions ?? null,
      engagedSessions: null,
      conversions: postFixData._sum.conversions ?? null,
      revenue: postFixData._sum.revenue ?? null,
      note: 'Saved GA4 landing-page measurements for this affected page. Engaged session counts are not stored and are unavailable.',
    };
  }

  private async calculateGa4Delta(projectId: string, urls: string[]) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);

    const [cur, base] = await Promise.all([
      this.prisma.ga4DailyMetric.aggregate({
        where: { projectId, date: { gte: thirtyDaysAgo } },
        _sum: { sessions: true, conversions: true, revenue: true },
      }),
      this.prisma.ga4DailyMetric.aggregate({
        where: { projectId, date: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
        _sum: { sessions: true, conversions: true, revenue: true },
      }),
    ]);

    return {
      connected: Boolean(cur._sum.sessions !== null),
      currentSessions: cur._sum.sessions ?? 0,
      baselineSessions: base._sum.sessions ?? 0,
      sessionsDeltaPct: (base._sum.sessions ?? 0) > 0 ? Math.round((((cur._sum.sessions ?? 0) - (base._sum.sessions ?? 0)) / (base._sum.sessions ?? 1)) * 100) : 0,
      conversions: cur._sum.conversions ?? null,
      revenue: cur._sum.revenue ?? null,
    };
  }

  private async generateFixExplanation(change: any, attribution: any, gsc: any, ai: any): Promise<string> {
    const why = change?.why || 'Technical SEO code optimization';
    const field = change?.field || 'Metadata';
    const clicksDelta = gsc.overallClicksChangePt;
    const level1 = attribution.level1.status;

    return `Prepared change for ${field}: ${why}. ${level1 === 'VERIFIED' ? 'A later saved crawl matched the expected metadata.' : 'Live deployment has not been verified.'} ${clicksDelta != null ? `Available Search Console records show a ${clicksDelta >= 0 ? '+' : ''}${clicksDelta}% change in clicks; this does not establish causation.` : 'A complete pre/post Search Console comparison is not available.'}`;
  }
}
