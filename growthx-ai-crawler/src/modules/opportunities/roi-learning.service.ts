import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { NormalisedFinding } from './finding-adapter.interface';

export interface CategoryRoiWeight {
  category: string;
  sampleSize: number;
  improvedCount: number;
  flatOrRegressedCount: number;
  winRate: number;
  avgClicksDeltaPct: number | null;
  avgAiChangePt: number | null;
  multiplier: number;
  evidenceSummary: string;
}

const KNOWN_CATEGORIES = new Set(['TECHNICAL', 'SEO', 'CONTENT', 'LOCAL', 'AI_VISIBILITY']);

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function inferCategoryFromField(
  field?: string | null,
  explicitCategory?: string | null,
): string {
  const normCategory = (explicitCategory ?? '').toUpperCase().trim();
  if (KNOWN_CATEGORIES.has(normCategory)) return normCategory;

  const normField = (field ?? '').toUpperCase().trim();
  if (!normField) return 'TECHNICAL';

  if (
    ['META_TITLE', 'META_DESCRIPTION', 'H1_TAG', 'ALT_TEXT', 'INTERNAL_LINKING', 'OPEN_GRAPH'].includes(
      normField,
    )
  ) {
    return 'SEO';
  }
  if (normField.includes('LOCAL_BUSINESS') || normField.includes('GBP')) {
    return 'LOCAL';
  }
  if (normField.includes('CONTENT') || normField.includes('BLOG') || normField.includes('ARTICLE')) {
    return 'CONTENT';
  }
  if (normField.includes('AI_VISIBILITY') || normField.includes('LLMS_TXT')) {
    return 'AI_VISIBILITY';
  }
  return 'TECHNICAL';
}

/**
 * Self-Learning ROI Priority Engine.
 *
 * Reads real, measured post-deployment outcomes recorded by ProofOfImpactService
 * (`IMPACT_CONFIRMED`, `NO_IMPROVEMENT_DIAGNOSED`, `REGRESSION_DETECTED`) for a
 * project and computes a bounded per-category priority multiplier (0.85x–1.35x).
 *
 * Truthfulness invariant:
 * - When a project has zero measured outcomes in a category, multiplier is 1.0
 *   and zero ROI evidence is appended.
 * - Evidence text cites only exact measured counts/percentages from this project
 *   and never claims causation or uses industry benchmarks.
 */
@Injectable()
export class RoiLearningService {
  constructor(private readonly prisma: PrismaService) {}

  async computeCategoryWeights(projectId: string): Promise<Map<string, CategoryRoiWeight>> {
    const weights = new Map<string, CategoryRoiWeight>();
    if (!this.prisma.fixImpactLedgerEvent?.findMany) {
      return weights;
    }

    const events = await this.prisma.fixImpactLedgerEvent.findMany({
      where: {
        projectId,
        eventType: {
          in: ['IMPACT_CONFIRMED', 'NO_IMPROVEMENT_DIAGNOSED', 'REGRESSION_DETECTED'],
        },
      },
      select: {
        eventType: true,
        evidenceData: true,
        automationRunId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const runIds = Array.from(
      new Set(
        events
          .map((e) => e.automationRunId)
          .filter((id): id is string => typeof id === 'string' && Boolean(id)),
      ),
    );
    const runStepsById = new Map<string, Array<{ change?: { field?: string } }>>();
    if (runIds.length > 0 && this.prisma.automationRun?.findMany) {
      const runs = await this.prisma.automationRun.findMany({
        where: { id: { in: runIds }, projectId },
        select: { id: true, steps: true },
      });
      for (const run of runs) {
        if (Array.isArray(run.steps)) {
          runStepsById.set(run.id, run.steps as Array<{ change?: { field?: string } }>);
        }
      }
    }

    const buckets = new Map<
      string,
      {
        improved: number;
        flatOrRegressed: number;
        clicksDeltas: number[];
        aiChanges: number[];
      }
    >();

    for (const event of events) {
      const data = (event.evidenceData ?? {}) as Record<string, unknown>;
      const steps = event.automationRunId ? (runStepsById.get(event.automationRunId) ?? []) : [];
      const firstField =
        typeof data.field === 'string'
          ? data.field
          : steps.find((s) => s?.change?.field)?.change?.field;
      const category = inferCategoryFromField(
        firstField,
        typeof data.category === 'string' ? data.category : null,
      );

      const bucket = buckets.get(category) ?? {
        improved: 0,
        flatOrRegressed: 0,
        clicksDeltas: [],
        aiChanges: [],
      };

      if (event.eventType === 'IMPACT_CONFIRMED') {
        bucket.improved++;
      } else {
        bucket.flatOrRegressed++;
      }

      if (typeof data.clicksDelta === 'number' && Number.isFinite(data.clicksDelta)) {
        bucket.clicksDeltas.push(data.clicksDelta);
      }
      if (typeof data.aiChangePt === 'number' && Number.isFinite(data.aiChangePt)) {
        bucket.aiChanges.push(data.aiChangePt);
      }

      buckets.set(category, bucket);
    }

    for (const [category, b] of buckets.entries()) {
      const sampleSize = b.improved + b.flatOrRegressed;
      if (sampleSize === 0) continue;

      const winRate = b.improved / sampleSize;
      const avgClicksDeltaPct =
        b.clicksDeltas.length > 0
          ? Math.round(b.clicksDeltas.reduce((s, n) => s + n, 0) / b.clicksDeltas.length)
          : null;
      const avgAiChangePt =
        b.aiChanges.length > 0
          ? Math.round(b.aiChanges.reduce((s, n) => s + n, 0) / b.aiChanges.length)
          : null;

      // Shrinkage prevents a single noisy observation from dominating priority order.
      const confidence = Math.min(1, sampleSize / 4);
      const winComponent = (winRate - 0.5) * 0.6;
      const clickComponent =
        avgClicksDeltaPct != null ? clamp(avgClicksDeltaPct / 100, -0.2, 0.25) * 0.4 : 0;
      const aiComponent =
        avgAiChangePt != null ? clamp(avgAiChangePt / 25, -0.1, 0.15) * 0.25 : 0;
      const multiplier = Number(
        clamp(1 + (winComponent + clickComponent + aiComponent) * confidence, 0.85, 1.35).toFixed(3),
      );

      const metricParts: string[] = [];
      if (avgClicksDeltaPct != null) {
        metricParts.push(
          `${avgClicksDeltaPct > 0 ? '+' : ''}${avgClicksDeltaPct}% avg clicks`,
        );
      }
      if (avgAiChangePt != null && avgAiChangePt !== 0) {
        metricParts.push(`${avgAiChangePt > 0 ? '+' : ''}${avgAiChangePt}pt AI mentions`);
      }

      const evidenceSummary =
        `${b.improved}/${sampleSize} measured ${category} fix${sampleSize === 1 ? '' : 'es'} observed positive change` +
        (metricParts.length ? ` (${metricParts.join(', ')})` : '');

      weights.set(category, {
        category,
        sampleSize,
        improvedCount: b.improved,
        flatOrRegressedCount: b.flatOrRegressed,
        winRate,
        avgClicksDeltaPct,
        avgAiChangePt,
        multiplier,
        evidenceSummary,
      });
    }

    return weights;
  }

  applyRoiWeight(
    finding: Pick<NormalisedFinding, 'category' | 'impact' | 'confidence' | 'evidence'>,
    weights: Map<string, CategoryRoiWeight>,
  ): {
    impact: number;
    priority: number;
    evidence: NormalisedFinding['evidence'];
  } {
    const baseEvidence = (finding.evidence ?? []).filter(
      (e) => e?.label !== 'Site historical ROI',
    );
    const weight = weights.get(finding.category.toUpperCase());
    if (!weight || weight.sampleSize === 0) {
      return {
        impact: finding.impact,
        priority: Number((finding.impact * (finding.confidence / 100)).toFixed(2)),
        evidence: baseEvidence,
      };
    }

    const impact = clamp(Math.round(finding.impact * weight.multiplier), 1, 100);
    const priority = Number((impact * (finding.confidence / 100)).toFixed(2));
    const evidence: NormalisedFinding['evidence'] = [
      ...baseEvidence,
      {
        label: 'Site historical ROI',
        value: weight.evidenceSummary,
        source: 'Proof of Impact',
      },
    ];

    return { impact, priority, evidence };
  }
}
