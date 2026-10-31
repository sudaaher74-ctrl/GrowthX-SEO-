import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FindingAdapter, NormalisedFinding } from '../opportunities/finding-adapter.interface';
import * as crypto from 'crypto';

@Injectable()
export class AiVisibilityAdapter implements FindingAdapter {
  private readonly logger = new Logger(AiVisibilityAdapter.name);
  source = 'MARKET' as const;

  constructor(private readonly prisma: PrismaService) {}

  async collect(projectId: string): Promise<NormalisedFinding[]> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        websites: { select: { domain: true }, take: 1 },
      },
    });

    if (!project) return [];

    const organizationId = project.organizationId;
    const businessName = project.name || project.websites[0]?.domain || 'your business';
    const domain = (project.websites[0]?.domain || '').toLowerCase().replace(/^www\./, '');

    // 1. Locate the latest AI Visibility scan or journey
    const [latestJourney, latestScan] = await Promise.all([
      this.prisma.aiVisibilityJourney.findFirst({
        where: { projectId, scanId: { not: null } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.aiVisibilityScan.findFirst({
        where: {
          projectId,
          status: { in: ['COMPLETED', 'PARTIAL'] },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    let scanId = latestJourney?.scanId || latestScan?.id;
    if (!scanId) {
      const anyScan = await this.prisma.aiVisibilityScan.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });
      scanId = anyScan?.id;
    }

    if (!scanId) return [];

    // 2. Fetch all successfully saved assistant responses
    const responses = await this.prisma.aiVisibilityResponse.findMany({
      where: {
        scanRun: { scanId },
        errorMessage: null,
      },
      include: {
        prompt: true,
        mentions: true,
        citations: true,
        analysis: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!responses.length) return [];

    const findings: NormalisedFinding[] = [];
    const seenFingerprints = new Set<string>();

    // 3. Track competitor wins and missed prompts
    const lossesByCompetitor = new Map<
      string,
      { promptText: string; provider: string; model: string }[]
    >();
    const unmentionedPrompts: { promptText: string; provider: string; model: string }[] = [];

    for (const r of responses) {
      const promptText = r.prompt?.text || r.promptText;
      const customerMentioned =
        r.mentions.some((m) => m.isCustomer) || (r.analysis?.brandMentioned ?? false);
      const customerRecommended =
        r.mentions.some((m) => m.isCustomer && (m.recommended || m.shortlisted)) ||
        (r.analysis?.recommended ?? false);

      const competitorNames = new Set<string>();

      // Competitors named in mentions
      for (const m of r.mentions) {
        if (!m.isCustomer && m.brandName?.trim()) {
          competitorNames.add(m.brandName.trim());
        }
      }

      // External domains cited in response links
      for (const c of r.citations) {
        if (!c.brandMentioned && c.domain?.trim()) {
          const clean = c.domain.trim().toLowerCase().replace(/^www\./, '');
          if (!domain || !clean.includes(domain)) {
            competitorNames.add(c.domain.trim());
          }
        }
      }

      // If customer was NOT recommended and competitors were cited / recommended
      if (!customerRecommended && competitorNames.size > 0) {
        for (const comp of competitorNames) {
          if (!lossesByCompetitor.has(comp)) {
            lossesByCompetitor.set(comp, []);
          }
          lossesByCompetitor.get(comp)!.push({
            promptText,
            provider: r.provider,
            model: r.model,
          });
        }
      }

      // If customer brand was completely omitted from answer
      if (!customerMentioned) {
        unmentionedPrompts.push({
          promptText,
          provider: r.provider,
          model: r.model,
        });
      }
    }

    // 4. Generate finding for each competitor winning recommendation/citation share
    for (const [competitorName, lostPrompts] of lossesByCompetitor.entries()) {
      const slug = competitorName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const fingerprint = crypto
        .createHash('sha1')
        .update(`ai-loss|${projectId}|${slug}`)
        .digest('hex')
        .slice(0, 24);

      if (seenFingerprints.has(fingerprint)) continue;
      seenFingerprints.add(fingerprint);

      const uniquePrompts = Array.from(new Set(lostPrompts.map((p) => p.promptText)));
      const sample = lostPrompts[0];

      findings.push({
        projectId,
        organizationId,
        fingerprint,
        source: this.source,
        category: 'COMPETITOR',
        title: `AI models cite ${competitorName} instead of your business`,
        summary: `Across ${uniquePrompts.length} buyer ${uniquePrompts.length === 1 ? 'query' : 'queries'}, AI assistants (including ${sample.model || sample.provider}) suggested ${competitorName} but did not recommend your brand.`,
        recommendedAction: `Publish dedicated comparison and solution pages targeting these buyer queries, update local citations, and add structured entity schemas to earn recommendation share over ${competitorName}.`,
        evidence: [
          { label: 'Competitor', value: competitorName, source: 'AI Visibility Scan' },
          { label: 'Lost Queries', value: uniquePrompts.length.toString(), source: 'AI Mentions' },
          { label: 'Example Query', value: sample.promptText, source: 'AI Prompts' },
          { label: 'AI Engine', value: `${sample.provider} (${sample.model})`, source: 'AI Responses' },
        ],
        potential: 'HIGH',
        effort: 'MEDIUM',
        confidence: 90,
        impact: 85,
        fixClass: 'MANUAL',
        affectedPages: [],
        affectedCount: uniquePrompts.length,
        detailType: 'AI_VISIBILITY_LOSS',
        detailRef: competitorName,
      });
    }

    // 5. Zero brand visibility on commercial queries
    if (unmentionedPrompts.length > 0) {
      const uniqueUnmentioned = Array.from(new Set(unmentionedPrompts.map((p) => p.promptText)));
      const fp = crypto
        .createHash('sha1')
        .update(`ai-zero-visibility|${projectId}`)
        .digest('hex')
        .slice(0, 24);

      if (!seenFingerprints.has(fp)) {
        seenFingerprints.add(fp);
        const sample = unmentionedPrompts[0];
        findings.push({
          projectId,
          organizationId,
          fingerprint: fp,
          source: this.source,
          category: 'CONTENT',
          title: `Zero AI brand visibility across ${uniqueUnmentioned.length} commercial buyer queries`,
          summary: `Major AI search engines (including ${sample.provider}) answered ${uniqueUnmentioned.length} commercial buyer prompts without citing or mentioning ${businessName}.`,
          recommendedAction: `Create content targeting these commercial prompts, embed LocalBusiness structured data, and build entity authority to appear in AI search results.`,
          evidence: [
            { label: 'Omitted Queries', value: uniqueUnmentioned.length.toString(), source: 'AI Visibility Scan' },
            { label: 'Example Query', value: sample.promptText, source: 'Buyer Prompts' },
            { label: 'AI Assistant', value: `${sample.provider} (${sample.model})`, source: 'AI Engine' },
          ],
          potential: 'HIGH',
          effort: 'MEDIUM',
          confidence: 88,
          impact: 80,
          fixClass: 'MANUAL',
          affectedPages: [],
          affectedCount: uniqueUnmentioned.length,
          detailType: 'AI_ZERO_VISIBILITY',
          detailRef: projectId,
        });
      }
    }

    // 6. Incorporate actions from visibility journey analysis if available
    if (latestJourney?.analysis && Array.isArray(latestJourney.analysis)) {
      for (const assessment of latestJourney.analysis as any[]) {
        if (Array.isArray(assessment.actions)) {
          for (const action of assessment.actions) {
            if (!action.title?.trim()) continue;
            const actionSlug = action.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
            const fp = crypto
              .createHash('sha1')
              .update(`ai-journey-action|${projectId}|${actionSlug}`)
              .digest('hex')
              .slice(0, 24);

            if (!seenFingerprints.has(fp)) {
              seenFingerprints.add(fp);
              const steps = Array.isArray(action.steps) ? action.steps.join(' ') : '';
              findings.push({
                projectId,
                organizationId,
                fingerprint: fp,
                source: this.source,
                category: 'SEO',
                title: action.title,
                summary: steps || `Improvement identified by ${assessment.provider || 'AI Visibility'} to close competitive gaps in AI search answers.`,
                recommendedAction: action.measureBy || 'Implement proposed changes and monitor AI answer presence.',
                evidence: [
                  { label: 'Source Assistant', value: assessment.provider || 'AI Visibility', source: 'Visibility Journey' },
                  { label: 'Priority', value: action.priority || 'high', source: 'Action Assessment' },
                  ...(action.timeframe ? [{ label: 'Timeframe', value: action.timeframe, source: 'Plan' }] : []),
                ],
                potential: action.priority === 'high' ? 'HIGH' : 'MEDIUM',
                effort: 'MEDIUM',
                confidence: 85,
                impact: action.priority === 'high' ? 85 : 75,
                fixClass: 'MANUAL',
                affectedPages: [],
                affectedCount: 1,
                detailType: 'AI_JOURNEY_ACTION',
                detailRef: action.title,
              });
            }
          }
        }
      }
    }

    return findings;
  }
}
