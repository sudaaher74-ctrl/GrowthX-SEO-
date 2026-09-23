import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FindingAdapter, NormalisedFinding } from '../opportunities/finding-adapter.interface';

@Injectable()
export class AiVisibilityAdapter implements FindingAdapter {
  readonly source = 'MARKET' as const;

  constructor(private readonly prisma: PrismaService) {}

  async collect(projectId: string): Promise<NormalisedFinding[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });

    if (!project) return [];

    // Fetch active prompts with their checks
    const prompts = await this.prisma.trackedPrompt.findMany({
      where: { projectId, isActive: true },
      include: {
        checks: {
          orderBy: { checkedAt: 'desc' },
          take: 5,
        },
      },
    });

    const findings: NormalisedFinding[] = [];

    for (const prompt of prompts) {
      // The honest zero: Emit findings ONLY when PromptCheck rows exist.
      // When none exist, no sweep has run yet, so do not emit 0% findings.
      if (!prompt.checks || prompt.checks.length === 0) {
        continue;
      }

      // Check if brand was absent across the latest checks
      const hasCitation = prompt.checks.some((check) => check.cited === true);
      if (hasCitation) {
        continue; // Brand was cited, no gap finding
      }

      const latestCheck = prompt.checks[0];
      const competitors = Array.from(
        new Set(prompt.checks.flatMap((c) => c.competitorsCited || [])),
      );

      // Stable fingerprint pattern: ${projectId}::AIVIS::${promptId}
      const fingerprint = `${projectId}::AIVIS::${prompt.id}`;

      findings.push({
        projectId,
        organizationId: project.organizationId,
        fingerprint,
        source: this.source,
        category: 'MARKETING',
        title: `AI citation missing for prompt: "${prompt.text}"`,
        summary: `Your brand was not cited in recent AI model sweeps for "${prompt.text}".${
          competitors.length > 0 ? ` Competitors cited: ${competitors.slice(0, 3).join(', ')}.` : ''
        }`,
        recommendedAction: `Add authoritative content and schema disambiguation targeting query "${prompt.text}".`,
        evidence: [
          {
            label: 'Tracked Prompt',
            value: prompt.text,
            source: 'AI_SEARCH_PROMPT',
          },
          {
            label: 'Latest Assistant Tested',
            value: latestCheck.assistant,
            source: 'AI_SEARCH_SWEEP',
          },
          ...(competitors.length > 0
            ? [
                {
                  label: 'Competitors Cited',
                  value: competitors.slice(0, 5).join(', '),
                  source: 'AI_SEARCH_SWEEP',
                },
              ]
            : []),
        ],
        potential: 'HIGH',
        effort: 'MEDIUM',
        confidence: 90,
        impact: prompt.estimatedVolume
          ? Math.min(100, Math.max(30, Math.round(prompt.estimatedVolume / 10)))
          : 65,
        fixClass: 'APPROVAL',
        affectedPages: [],
        affectedCount: 1,
        detailType: 'AI_VISIBILITY_PROMPT',
        detailRef: prompt.id,
      });
    }

    return findings;
  }
}
