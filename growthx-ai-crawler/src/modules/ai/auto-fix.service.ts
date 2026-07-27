import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface GeneratedFixPatch {
  fixType: 'META_TITLE' | 'META_DESCRIPTION' | 'ALT_TEXT' | 'FAQ_SCHEMA' | 'PRODUCT_SCHEMA' | 'CANONICAL_URL' | 'INTERNAL_LINKING';
  targetUrl: string;
  originalValue?: string;
  proposedValue: string;
  codeSnippet: string;
}

@Injectable()
export class AutoFixService {
  private readonly logger = new Logger(AutoFixService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates specific code/text patch for an issue.
   * Module 16 Requirement: Every change requires user approval before execution.
   */
  async generateFixPatch(issueId: string): Promise<GeneratedFixPatch> {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: { page: true, aiRecommendation: true },
    });

    if (!issue || !issue.page) {
      throw new NotFoundException(`Issue or associated page not found for ID ${issueId}`);
    }

    this.logger.log(`Generating Auto-Fix patch for issue ${issue.issueType} on ${issue.affectedUrl}...`);

    let patch: GeneratedFixPatch;

    switch (issue.issueType) {
      case 'MISSING_TITLE':
      case 'SHORT_TITLE':
      case 'LONG_TITLE': {
        const urlParts = issue.affectedUrl.split('/').filter(Boolean);
        const slug = urlParts[urlParts.length - 1] || 'Home';
        const cleanSlug = slug.replace(/[-_]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const proposedTitle = `${cleanSlug} | Enterprise Software Solutions - GrowthX AI`;
        patch = {
          fixType: 'META_TITLE',
          targetUrl: issue.affectedUrl,
          originalValue: issue.page.title || 'None',
          proposedValue: proposedTitle,
          codeSnippet: `<title>${proposedTitle}</title>`,
        };
        break;
      }

      case 'MISSING_META_DESCRIPTION': {
        const proposedDesc = `Discover comprehensive insights and technical specifications for ${issue.affectedUrl}. Optimize your workflow with GrowthX AI enterprise platform.`;
        patch = {
          fixType: 'META_DESCRIPTION',
          targetUrl: issue.affectedUrl,
          originalValue: issue.page.metaDescription || 'None',
          proposedValue: proposedDesc,
          codeSnippet: `<meta name="description" content="${proposedDesc}" />`,
        };
        break;
      }

      case 'MISSING_ALT_TEXT': {
        patch = {
          fixType: 'ALT_TEXT',
          targetUrl: issue.affectedUrl,
          originalValue: 'img without alt attribute',
          proposedValue: 'Descriptive illustration of GrowthX AI platform workflow and analytics dashboard',
          codeSnippet: `<img src="..." alt="Descriptive illustration of GrowthX AI platform workflow and analytics dashboard" loading="lazy" />`,
        };
        break;
      }

      case 'MISSING_CANONICAL':
      case 'BROKEN_CANONICAL': {
        const cleanCanonical = issue.affectedUrl.split('?')[0].replace('http://', 'https://');
        patch = {
          fixType: 'CANONICAL_URL',
          targetUrl: issue.affectedUrl,
          originalValue: issue.page.canonicalUrl || 'None',
          proposedValue: cleanCanonical,
          codeSnippet: `<link rel="canonical" href="${cleanCanonical}" />`,
        };
        break;
      }

      case 'SCHEMA_ERROR_FAQ':
      case 'SCHEMA_ERROR_FAQPage': {
        const faqSchema = {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            {
              "@type": "Question",
              "name": "What is GrowthX AI Enterprise Crawler?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "GrowthX AI is a high-performance technical SEO audit platform for enterprise websites."
              }
            }
          ]
        };
        patch = {
          fixType: 'FAQ_SCHEMA',
          targetUrl: issue.affectedUrl,
          proposedValue: 'Valid JSON-LD FAQPage Schema',
          codeSnippet: `<script type="application/ld+json">\n${JSON.stringify(faqSchema, null, 2)}\n</script>`,
        };
        break;
      }

      case 'SCHEMA_ERROR_PRODUCT':
      case 'SCHEMA_ERROR_Product': {
        const prodSchema = {
          "@context": "https://schema.org/",
          "@type": "Product",
          "name": "GrowthX AI SEO Suite",
          "description": "Automated SEO audit and optimization platform.",
          "offers": {
            "@type": "Offer",
            "url": issue.affectedUrl,
            "priceCurrency": "USD",
            "price": "99.00",
            "availability": "https://schema.org/InStock"
          }
        };
        patch = {
          fixType: 'PRODUCT_SCHEMA',
          targetUrl: issue.affectedUrl,
          proposedValue: 'Valid JSON-LD Product Schema with Offer',
          codeSnippet: `<script type="application/ld+json">\n${JSON.stringify(prodSchema, null, 2)}\n</script>`,
        };
        break;
      }

      case 'ORPHAN_PAGE': {
        patch = {
          fixType: 'INTERNAL_LINKING',
          targetUrl: issue.affectedUrl,
          proposedValue: `Add contextual internal link from homepage or sitemap category index`,
          codeSnippet: `<a href="${issue.affectedUrl}">View ${issue.affectedUrl.split('/').pop() || 'Details'}</a>`,
        };
        break;
      }

      default: {
        patch = {
          fixType: 'META_TITLE',
          targetUrl: issue.affectedUrl,
          proposedValue: issue.recommendation,
          codeSnippet: `<!-- Apply recommendation: ${issue.recommendation} -->`,
        };
      }
    }

    // Save proposed patch to database
    await this.prisma.aIRecommendation.upsert({
      where: { issueId: issue.id },
      update: {
        recommendedFixPatch: JSON.stringify(patch, null, 2),
        status: 'PENDING_APPROVAL',
      },
      create: {
        issueId: issue.id,
        whyItMatters: issue.aiRecommendation?.whyItMatters || 'Improves technical SEO health.',
        seoImpact: issue.aiRecommendation?.seoImpact || 'Positive ranking signal.',
        businessImpact: issue.aiRecommendation?.businessImpact || 'Higher traffic retention.',
        priorityScore: issue.aiRecommendation?.priorityScore || 75,
        recommendedFixPatch: JSON.stringify(patch, null, 2),
        expectedOutcome: issue.aiRecommendation?.expectedOutcome || 'Resolved audit issue.',
        status: 'PENDING_APPROVAL',
      },
    });

    return patch;
  }

  /**
   * User approves the AI recommendation.
   * Module 16: Every change requires user approval before execution.
   */
  async approveAndExecuteFix(issueId: string, approvedByUserId: string): Promise<{ success: boolean; message: string; patch: any }> {
    const rec = await this.prisma.aIRecommendation.findUnique({
      where: { issueId },
      include: { issue: true },
    });

    if (!rec) {
      throw new NotFoundException(`No AI recommendation found for issue ID ${issueId}`);
    }

    if (rec.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException(`Recommendation is currently in status ${rec.status} and cannot be re-approved.`);
    }

    this.logger.log(`User ${approvedByUserId} APPROVED fix for issue ${issueId}. Executing automated workflow...`);

    // In a live integration, this would trigger an API call to CMS/GitHub PR or database update.
    // We record state change to 'APPROVED' and then 'APPLIED'.
    await this.prisma.aIRecommendation.update({
      where: { issueId },
      data: {
        status: 'APPLIED',
        approvedBy: approvedByUserId,
        appliedAt: new Date(),
      },
    });

    await this.prisma.issue.update({
      where: { id: issueId },
      data: { status: 'RESOLVED' },
    });

    let parsedPatch = {};
    try {
      parsedPatch = JSON.parse(rec.recommendedFixPatch);
    } catch (e) {
      parsedPatch = { text: rec.recommendedFixPatch };
    }

    return {
      success: true,
      message: `Successfully approved and applied AI fix patch for issue on ${rec.issue.affectedUrl}. Issue marked RESOLVED.`,
      patch: parsedPatch,
    };
  }

  async rejectFix(issueId: string, rejectedByUserId: string): Promise<{ success: boolean; message: string }> {
    await this.prisma.aIRecommendation.update({
      where: { issueId },
      data: {
        status: 'REJECTED',
        approvedBy: rejectedByUserId,
      },
    });

    await this.prisma.issue.update({
      where: { id: issueId },
      data: { status: 'IGNORED' },
    });

    return { success: true, message: `Recommendation for issue ${issueId} rejected and marked IGNORED.` };
  }
}
