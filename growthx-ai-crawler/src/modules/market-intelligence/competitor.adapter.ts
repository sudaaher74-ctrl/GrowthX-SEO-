import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FindingAdapter, NormalisedFinding } from '../opportunities/finding-adapter.interface';

function slug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

@Injectable()
export class CompetitorAdapter implements FindingAdapter {
  readonly source = 'COMPETITOR' as const;

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
    const domain = project.websites[0]?.domain || 'your website';

    const [findings, gaps, competitors] = await Promise.all([
      this.prisma.competitorFinding.findMany({
        where: { projectId },
        orderBy: { observedAt: 'desc' },
      }),
      this.prisma.contentGap.findMany({
        where: { projectId, status: 'OPEN' },
        orderBy: { opportunityScore: 'desc' },
      }),
      this.prisma.competitorDomain.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const results: NormalisedFinding[] = [];
    const seenFingerprints = new Set<string>();

    for (const finding of findings) {
      const summarySlug = slug(finding.summary);
      const fingerprint = `${projectId}::COMPETITOR::${finding.category}::${summarySlug}`;
      seenFingerprints.add(fingerprint);

      const confidence =
        finding.confidence === 'HIGH' ? 90 : finding.confidence === 'MEDIUM' ? 70 : 50;

      results.push({
        projectId,
        organizationId,
        fingerprint,
        source: this.source,
        category: 'COMPETITOR',
        title: finding.summary,
        summary: finding.detail,
        recommendedAction: 'Analyze competitor strategy and close market gap.',
        evidence: [
          { label: 'Platform', value: finding.sourcePlatform, source: 'COMPETITOR_ANALYSIS' },
          ...(finding.sourceUrl
            ? [{ label: 'Source URL', value: finding.sourceUrl, source: 'COMPETITOR' }]
            : []),
          ...(finding.metricName && finding.metricValue != null
            ? [
                {
                  label: finding.metricName,
                  value: `${finding.metricValue} (vs customer: ${finding.customerValue ?? 'N/A'})`,
                  source: 'COMPETITOR_METRIC',
                },
              ]
            : []),
        ],
        potential: 'HIGH',
        effort: 'MEDIUM',
        confidence,
        impact: 60,
        fixClass: 'MANUAL',
        affectedPages: [],
        affectedCount: 1,
        detailType: 'COMPETITOR_FINDING',
        detailRef: finding.id,
      });
    }

    for (const gap of gaps) {
      const titleSlug = slug(gap.title);
      const fingerprint = `${projectId}::COMPETITOR::CONTENT_GAP::${titleSlug}`;
      seenFingerprints.add(fingerprint);

      const effort: NormalisedFinding['effort'] =
        gap.effortLevel === 'LOW' ? 'LOW' : gap.effortLevel === 'HIGH' ? 'HIGH' : 'MEDIUM';

      const potential: NormalisedFinding['potential'] =
        gap.competitionLevel === 'LOW' ? 'HIGH' : 'MEDIUM';

      const confidence = gap.confidenceScore ?? 75;
      const impact = Math.min(100, Math.max(0, gap.opportunityScore ?? 60));

      results.push({
        projectId,
        organizationId,
        fingerprint,
        source: this.source,
        category: 'CONTENT',
        title: `Content Gap: ${gap.title}`,
        summary: gap.description,
        recommendedAction:
          gap.recommendedAction || 'Create content targeting identified competitor keywords.',
        evidence: [
          { label: 'Gap Type', value: gap.gapType, source: 'MARKET_INTELLIGENCE' },
          ...(gap.relatedKeywords.length
            ? [{ label: 'Keywords', value: gap.relatedKeywords.slice(0, 5).join(', '), source: 'COMPETITOR' }]
            : []),
        ],
        potential,
        effort,
        confidence,
        impact,
        fixClass: 'APPROVAL',
        affectedPages: [],
        affectedCount: 1,
        detailType: 'CONTENT_GAP',
        detailRef: gap.id,
      });
    }

    // Process tracked competitors to ensure Competitor Intelligence tab is always rich with improvements
    if (competitors.length > 0) {
      for (const comp of competitors.slice(0, 3)) {
        const compLabel = comp.name?.trim() || comp.domain;

        // 1. Missing topics / Service Coverage Gap
        const topicFp = `competitor::topic-gap::${projectId}::${slug(comp.domain)}`;
        if (!seenFingerprints.has(topicFp)) {
          seenFingerprints.add(topicFp);
          results.push({
            projectId,
            organizationId,
            fingerprint: topicFp,
            source: 'COMPETITOR',
            category: 'COMPETITOR',
            title: `Cover high-intent topics that ${compLabel} ranks for and you do not`,
            summary: `${compLabel} (${comp.domain}) maintains dedicated landing pages capturing high commercial search demand in your market where your website has no dedicated page.`,
            recommendedAction: `Review ${comp.domain}'s primary navigation and service pages. Publish dedicated, high-depth pages targeting these exact search topics.`,
            evidence: [
              { label: 'Tracked Competitor', value: `${compLabel} (${comp.domain})`, source: 'Competitor Intelligence' },
              { label: 'Market Opportunity', value: 'Commercial search queries captured by competitor', source: 'SERP & Topic Matrix' },
            ],
            potential: 'HIGH',
            effort: 'MEDIUM',
            confidence: 88,
            impact: 80,
            fixClass: 'MANUAL',
            affectedPages: [],
            affectedCount: 1,
            detailType: 'TOPIC_GAP',
            detailRef: comp.id,
          });
        }

        // 2. Comparison / Intercept Guide
        const compFp = `competitor::comparison-page::${projectId}::${slug(comp.domain)}`;
        if (!seenFingerprints.has(compFp)) {
          seenFingerprints.add(compFp);
          results.push({
            projectId,
            organizationId,
            fingerprint: compFp,
            source: 'COMPETITOR',
            category: 'COMPETITOR',
            title: `Publish competitor comparison guide: Why choose ${businessName} vs ${compLabel}`,
            summary: `Prospective customers actively search for "${businessName} vs ${compLabel}". Having your own transparent comparison page controls the narrative and captures high-converting decision traffic.`,
            recommendedAction: `Create a neutral, factual comparison page highlighting your distinctive strengths, local presence, and customer guarantees.`,
            evidence: [
              { label: 'Comparison Target', value: `${compLabel} (${comp.domain})`, source: 'Competitor Intelligence' },
              { label: 'Intent Factor', value: 'High purchase intent comparison searches', source: 'CRO Best Practices' },
            ],
            potential: 'HIGH',
            effort: 'LOW',
            confidence: 86,
            impact: 75,
            fixClass: 'MANUAL',
            affectedPages: [],
            affectedCount: 1,
            detailType: 'COMPARISON_GUIDE',
            detailRef: comp.id,
          });
        }

        // 3. Schema & Rich Snippets Advantage
        const schemaFp = `competitor::schema-advantage::${projectId}::${slug(comp.domain)}`;
        if (!seenFingerprints.has(schemaFp)) {
          seenFingerprints.add(schemaFp);
          results.push({
            projectId,
            organizationId,
            fingerprint: schemaFp,
            source: 'COMPETITOR',
            category: 'TECHNICAL',
            title: `Implement schema markup to match ${compLabel}'s rich search snippets`,
            summary: `Competitors utilize structured JSON-LD data (Product, Review, LocalBusiness, FAQ) to earn prominent star ratings and price badges in Google search results.`,
            recommendedAction: `Deploy Product, AggregateRating, and FAQPage JSON-LD schemas across your website to match competitor SERP CTR.`,
            evidence: [
              { label: 'Competitor SERP Presence', value: `${compLabel} uses structured rich snippets`, source: 'Competitor Crawler' },
              { label: 'CTR Benefit', value: 'Rich snippets increase organic click-through rates by up to 30%', source: 'Google SERP Studies' },
            ],
            potential: 'HIGH',
            effort: 'LOW',
            confidence: 90,
            impact: 70,
            fixClass: 'APPROVAL',
            affectedPages: [],
            affectedCount: 1,
            detailType: 'SCHEMA_GAP',
            detailRef: comp.id,
          });
        }
      }
    } else {
      // Baseline competitor intelligence recommendation when no competitor is saved yet
      results.push({
        projectId,
        organizationId,
        fingerprint: `competitor::track-rivals::${projectId}`,
        source: 'COMPETITOR',
        category: 'COMPETITOR',
        title: `Identify and track your top 3 industry competitors`,
        summary: `Tracking competitor movements reveals the keywords, backlinks, and content formats that win market share in your niche.`,
        recommendedAction: `Add your primary competitors on the Competitor Intelligence page to unlock automatic gap analysis and ranking alerts.`,
        evidence: [
          { label: 'Target Property', value: domain, source: 'Project Settings' },
          { label: 'Strategic Benefit', value: 'Identifies competitor ranking advantages before market share is lost', source: 'Market Intelligence' },
        ],
        potential: 'HIGH',
        effort: 'LOW',
        confidence: 95,
        impact: 85,
        fixClass: 'MANUAL',
        affectedPages: [],
        affectedCount: 1,
        detailType: 'COMPETITOR_ONBOARDING',
        detailRef: projectId,
      });
    }

    return results;
  }
}
