import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FindingAdapter, NormalisedFinding } from '../opportunities/finding-adapter.interface';

function hostOf(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, '');
  } catch {
    return urlStr;
  }
}

@Injectable()
export class BacklinksAdapter implements FindingAdapter {
  private readonly logger = new Logger(BacklinksAdapter.name);
  readonly source = 'BACKLINKS' as const;

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
    const domain = project.websites[0]?.domain || project.name || 'your website';
    const findings: NormalisedFinding[] = [];

    // 1. Monitored backlink sources & competitor candidate links
    const sources = await this.prisma.backlinkSource.findMany({
      where: { projectId },
      include: {
        links: true,
        recommendation: { select: { analysis: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const seenFingerprints = new Set<string>();

    for (const source of sources) {
      const compLinks = source.links.filter((l) => l.targetKind === 'COMPETITOR');
      const lostLinks = source.links.filter((l) => l.status === 'LOST');
      const sourceHost = hostOf(source.sourceUrl);

      // A. Publisher recommends competitors but not the customer
      if (compLinks.length > 0) {
        const compHosts = [...new Set(compLinks.map((l) => l.targetHost || hostOf(l.targetUrl)))];
        const fp = `backlink::candidate-publisher::${source.id}`;
        if (!seenFingerprints.has(fp)) {
          seenFingerprints.add(fp);
          findings.push({
            projectId,
            organizationId,
            fingerprint: fp,
            source: 'BACKLINKS',
            category: 'SEO',
            title: `Editorial opportunity: ${sourceHost} links to competitors but not you`,
            summary: `This publisher covers your market and currently links to competitors (${compHosts.slice(0, 3).join(', ')}). Your site is not featured yet.`,
            recommendedAction: `Review editorial guidelines for ${source.sourceUrl} and pitch your business or product listing to the editor.`,
            evidence: [
              { label: 'Publisher URL', value: source.sourceUrl, source: 'Backlink Intelligence' },
              { label: 'Competitors Featured', value: compHosts.join(', '), source: 'Competitor Link Observation' },
              { label: 'Opportunity Type', value: 'High-fit editorial inclusion', source: 'Recommendation Engine' },
            ],
            potential: 'HIGH',
            effort: 'MEDIUM',
            confidence: 88,
            impact: 80,
            fixClass: 'MANUAL',
            affectedPages: [source.sourceUrl],
            affectedCount: 1,
            detailType: 'BACKLINK_OPPORTUNITY',
            detailRef: source.id,
          });
        }
      }

      // B. Lost backlinks that can be reclaimed
      for (const link of lostLinks) {
        const fp = `backlink::lost-link::${link.id}`;
        if (!seenFingerprints.has(fp)) {
          seenFingerprints.add(fp);
          findings.push({
            projectId,
            organizationId,
            fingerprint: fp,
            source: 'BACKLINKS',
            category: 'SEO',
            title: `Reclaim lost backlink from ${sourceHost}`,
            summary: `A previously verified backlink pointing to ${link.targetUrl} is no longer detected on ${source.sourceUrl}.`,
            recommendedAction: `Check if your target page URL changed (set up a 301 permanent redirect) or contact the site owner to restore the link.`,
            evidence: [
              { label: 'Referring Source', value: source.sourceUrl, source: 'Backlink Observation' },
              { label: 'Destination URL', value: link.targetUrl, source: 'Backlink Monitor' },
              { label: 'Link Status', value: 'Lost / Link absent in recent sweep', source: 'Crawler Verification' },
            ],
            potential: 'HIGH',
            effort: 'LOW',
            confidence: 90,
            impact: 75,
            fixClass: 'MANUAL',
            affectedPages: [link.targetUrl],
            affectedCount: 1,
            detailType: 'LOST_BACKLINK',
            detailRef: link.id,
          });
        }
      }
    }

    // 2. Foundational link profile & authority improvements
    // Ensure the Backlinks tab always has high-impact, actionable improvements
    findings.push({
      projectId,
      organizationId,
      fingerprint: `backlink::foundational-citations::${projectId}`,
      source: 'BACKLINKS',
      category: 'SEO',
      title: `Build foundational niche backlinks and partner citations for ${domain}`,
      summary: `High-ranking sites in your market maintain diverse referring domains. Acquiring contextual links from niche directories, trade associations, and partners strengthens domain authority.`,
      recommendedAction: `Identify top 10 verified business directories and trade publications in your industry. Submit comprehensive profiles with brand links.`,
      evidence: [
        { label: 'Target Property', value: domain, source: 'Project Workspace' },
        { label: 'Monitored Referring Pages', value: `${sources.length} active sources`, source: 'Backlink Intelligence' },
        { label: 'Ranking Factor', value: 'Referring domain diversity directly impacts Google organic positions', source: 'Search Engine Best Practices' },
      ],
      potential: 'HIGH',
      effort: 'MEDIUM',
      confidence: 85,
      impact: 75,
      fixClass: 'MANUAL',
      affectedPages: [],
      affectedCount: 1,
      detailType: 'BACKLINK_STRATEGY',
      detailRef: projectId,
    });

    findings.push({
      projectId,
      organizationId,
      fingerprint: `backlink::anchor-diversity::${projectId}`,
      source: 'BACKLINKS',
      category: 'SEO',
      title: `Balance anchor text distribution across brand and topic keywords`,
      summary: `Search engines penalize over-optimized exact-match anchors and reward natural, descriptive branded anchor text profiles.`,
      recommendedAction: `Aim for 60% branded anchors (brand name/URL), 25% topical/service anchors, and 15% generic/navigational anchors.`,
      evidence: [
        { label: 'Target Ratio', value: '60% brand, 25% topical, 15% natural', source: 'Link Building Best Practices' },
        { label: 'Search Quality Signal', value: 'Natural anchor text profiles reduce algorithmic risk', source: 'GrowthX SEO Engine' },
      ],
      potential: 'MEDIUM',
      effort: 'LOW',
      confidence: 80,
      impact: 60,
      fixClass: 'APPROVAL',
      affectedPages: [],
      affectedCount: 1,
      detailType: 'ANCHOR_TEXT_OPTIMIZATION',
      detailRef: projectId,
    });

    findings.push({
      projectId,
      organizationId,
      fingerprint: `backlink::editorial-pr::${projectId}`,
      source: 'BACKLINKS',
      category: 'CONTENT',
      title: `Publish original industry data or case studies to earn editorial citations`,
      summary: `Publishing original customer outcome data and industry insights attracts natural citations from journalists, trade bloggers, and roundup editors.`,
      recommendedAction: `Package proprietary data or a milestone customer story into a shareable case study page and outreach to relevant industry writers.`,
      evidence: [
        { label: 'Link Acquisition Method', value: 'Original research & data-driven digital PR', source: 'Inbound Growth Playbook' },
        { label: 'Earned Link Potential', value: 'High editorial authority backlinks with zero reciprocal requirements', source: 'GrowthX Link Intelligence' },
      ],
      potential: 'HIGH',
      effort: 'MEDIUM',
      confidence: 82,
      impact: 70,
      fixClass: 'MANUAL',
      affectedPages: [],
      affectedCount: 1,
      detailType: 'DIGITAL_PR',
      detailRef: projectId,
    });

    return findings;
  }
}
