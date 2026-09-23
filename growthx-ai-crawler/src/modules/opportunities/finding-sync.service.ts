import { Injectable, Logger } from '@nestjs/common';
import { FindingLifecycle, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { WebsiteAuditAdapter } from '../issues/website-audit.adapter';
import { GbpAdapter } from '../local-seo/gbp.adapter';
import { CompetitorAdapter } from '../market-intelligence/competitor.adapter';
import { AiVisibilityAdapter } from '../ai-visibility/ai-visibility.adapter';
import { FindingAdapter, NormalisedFinding } from './finding-adapter.interface';

export interface SyncResult {
  created: number;
  updated: number;
  resolved: number;
}

@Injectable()
export class FindingSyncService {
  private readonly logger = new Logger(FindingSyncService.name);
  private readonly adapters: FindingAdapter[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly websiteAuditAdapter: WebsiteAuditAdapter,
    private readonly gbpAdapter: GbpAdapter,
    private readonly competitorAdapter: CompetitorAdapter,
    private readonly aiVisibilityAdapter: AiVisibilityAdapter,
  ) {
    this.adapters = [
      this.websiteAuditAdapter,
      this.gbpAdapter,
      this.competitorAdapter,
      this.aiVisibilityAdapter,
    ];
  }

  /**
   * Reconciles findings across all adapters into the single GrowthOpportunity table.
   *
   * Rules:
   * - Present, no existing row -> create (status: OPEN, lifecycle: QUEUED).
   * - Present, row exists -> update mutable fields, bump lastSeenAt. NEVER touch status or lifecycle.
   * - Absent, row is OPEN/QUEUED -> status: RESOLVED, lifecycle: RESOLVED, resolvedAt: now.
   * - Absent, row is DISMISSED -> leave alone.
   * - Absent, row is mid-execution (APPROVED, APPLYING, VERIFYING, etc.) -> leave alone.
   */
  async syncProject(projectId: string): Promise<SyncResult> {
    const results = await Promise.allSettled(
      this.adapters.map((adapter) => adapter.collect(projectId)),
    );

    const collectedFindings: NormalisedFinding[] = [];
    for (let i = 0; i < results.length; i++) {
      const res = results[i];
      if (res.status === 'fulfilled') {
        collectedFindings.push(...res.value);
      } else {
        this.logger.error(
          `Adapter ${this.adapters[i].constructor.name} failed for project ${projectId}: ${res.reason}`,
        );
      }
    }

    const collectedFingerprints = new Set<string>();
    let created = 0;
    let updated = 0;
    let resolved = 0;

    const now = new Date();

    for (const finding of collectedFindings) {
      collectedFingerprints.add(finding.fingerprint);

      const existing = await this.prisma.growthOpportunity.findUnique({
        where: {
          projectId_fingerprint: {
            projectId,
            fingerprint: finding.fingerprint,
          },
        },
      });

      if (!existing) {
        // Compute priority score from confidence and impact
        const priority = finding.impact * (finding.confidence / 100);

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
            evidence: finding.evidence as unknown as Prisma.InputJsonValue,
            potential: finding.potential,
            effort: finding.effort,
            confidence: finding.confidence,
            priority,
            impact: finding.impact,
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
        // Row exists: update mutable fields and lastSeenAt. NEVER touch status or lifecycle!
        const priority = finding.impact * (finding.confidence / 100);

        await this.prisma.growthOpportunity.update({
          where: { id: existing.id },
          data: {
            title: finding.title,
            summary: finding.summary,
            recommendedAction: finding.recommendedAction,
            evidence: finding.evidence as unknown as Prisma.InputJsonValue,
            potential: finding.potential,
            effort: finding.effort,
            confidence: finding.confidence,
            priority,
            impact: finding.impact,
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

    // Identify rows that are no longer detected
    const allStoredOpportunities = await this.prisma.growthOpportunity.findMany({
      where: { projectId },
      select: {
        id: true,
        fingerprint: true,
        status: true,
        lifecycle: true,
        transitions: true,
      },
    });

    for (const stored of allStoredOpportunities) {
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
      }
      // If row was DISMISSED, SNOOZED, or mid-execution (APPROVED, APPLYING, VERIFYING, etc.),
      // leave it alone!
    }

    return { created, updated, resolved };
  }
}
