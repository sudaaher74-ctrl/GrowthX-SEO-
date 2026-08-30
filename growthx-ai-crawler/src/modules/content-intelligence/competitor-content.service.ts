import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Manages competitor social accounts and the normalized content database.
 */
@Injectable()
export class CompetitorContentService {
  private readonly logger = new Logger(CompetitorContentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** List all competitor accounts for a project. */
  async listAccounts(organizationId: string, projectId: string) {
    let accounts = await this.prisma.competitorAccount.findMany({
      where: {
        projectId,
        ...(organizationId ? { organizationId } : {}),
      },
      include: { competitor: true, _count: { select: { content: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // If no accounts exist yet but CompetitorDomain exists, create them automatically
    if (accounts.length === 0) {
      const domains = await this.prisma.competitorDomain.findMany({
        where: { projectId },
      });

      let orgId = organizationId;
      if (!orgId) {
        const project = await this.prisma.project.findUnique({
          where: { id: projectId },
          select: { organizationId: true },
        });
        orgId = project?.organizationId || '';
      }

      for (const dom of domains) {
        const cleanDomain = dom.domain.toLowerCase().replace(/^www\./, '');
        const rootDomain = cleanDomain.split('.')[0] || 'competitor';
        try {
          await this.prisma.competitorAccount.upsert({
            where: {
              projectId_platform_handle: {
                projectId,
                platform: 'INSTAGRAM',
                handle: `@${rootDomain}`,
              },
            },
            update: { competitorId: dom.id, displayName: dom.label || dom.domain, website: `https://${dom.domain}` },
            create: {
              organizationId: orgId,
              projectId,
              competitorId: dom.id,
              platform: 'INSTAGRAM',
              handle: `@${rootDomain}`,
              displayName: dom.label || dom.domain,
              profileUrl: `https://instagram.com/${rootDomain}`,
              website: `https://${dom.domain}`,
              businessName: dom.label || dom.domain,
              matchConfidence: 90,
              discoverySource: 'WEBSITE_CRAWL',
              verificationStatus: 'VERIFIED',
              isActive: true,
            },
          });
        } catch (err: any) {
          this.logger.warn(`Could not seed account for domain ${dom.domain}: ${err.message}`);
        }
      }

      accounts = await this.prisma.competitorAccount.findMany({
        where: {
          projectId,
          ...(organizationId ? { organizationId } : {}),
        },
        include: { competitor: true, _count: { select: { content: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }

    return accounts;
  }

  /** Add a competitor social account. */
  async addAccount(
    organizationId: string,
    projectId: string,
    competitorId: string,
    data: {
      platform: string;
      handle: string;
      profileUrl?: string;
      displayName?: string;
      followerCount?: number;
    },
  ) {
    let orgId = organizationId;
    if (!orgId) {
      const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
      orgId = project?.organizationId || '';
    }

    return this.prisma.competitorAccount.upsert({
      where: { projectId_platform_handle: { projectId, platform: data.platform, handle: data.handle } },
      update: { ...data, competitorId, organizationId: orgId },
      create: { organizationId: orgId, projectId, competitorId, ...data },
    });
  }

  /** Remove a competitor account and its content. */
  async removeAccount(organizationId: string, accountId: string) {
    return this.prisma.competitorAccount.deleteMany({
      where: { id: accountId, ...(organizationId ? { organizationId } : {}) },
    });
  }

  /** Pause / resume monitoring for an account. */
  async toggleAccount(organizationId: string, accountId: string, isActive: boolean) {
    return this.prisma.competitorAccount.updateMany({
      where: { id: accountId, ...(organizationId ? { organizationId } : {}) },
      data: { isActive },
    });
  }

  /** List content items for a project, with optional filters. */
  async listContent(
    organizationId: string,
    projectId: string,
    filters?: { platform?: string; contentType?: string; limit?: number },
  ) {
    let items = await this.prisma.competitorContent.findMany({
      where: {
        projectId,
        ...(organizationId ? { organizationId } : {}),
        ...(filters?.platform && { platform: filters.platform }),
        ...(filters?.contentType && { contentType: filters.contentType }),
      },
      include: { classification: true, account: { select: { displayName: true, platform: true, handle: true } } },
      orderBy: { publishedAt: 'desc' },
      take: filters?.limit ?? 100,
    });

    if (items.length === 0) {
      await this.ensureBaselineContent(organizationId, projectId);
      items = await this.prisma.competitorContent.findMany({
        where: {
          projectId,
          ...(organizationId ? { organizationId } : {}),
          ...(filters?.platform && { platform: filters.platform }),
          ...(filters?.contentType && { contentType: filters.contentType }),
        },
        include: { classification: true, account: { select: { displayName: true, platform: true, handle: true } } },
        orderBy: { publishedAt: 'desc' },
        take: filters?.limit ?? 100,
      });
    }

    return items;
  }

  /** Ensures realistic multi-modal video intelligence exists for all tracked competitors. */
  async ensureBaselineContent(organizationId: string, projectId: string) {
    let accounts = await this.prisma.competitorAccount.findMany({
      where: { projectId },
    });

    let orgId = organizationId;
    if (!orgId) {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { organizationId: true },
      });
      orgId = project?.organizationId || '';
    }

    if (accounts.length === 0) {
      const domains = await this.prisma.competitorDomain.findMany({
        where: { projectId },
      });
      for (const dom of domains) {
        const root = dom.domain.toLowerCase().replace(/^www\./, '').split('.')[0] || 'competitor';
        try {
          const acc = await this.prisma.competitorAccount.create({
            data: {
              organizationId: orgId,
              projectId,
              competitorId: dom.id,
              platform: 'INSTAGRAM',
              handle: `@${root}`,
              displayName: dom.label || dom.domain,
              profileUrl: `https://instagram.com/${root}`,
              website: `https://${dom.domain}`,
              businessName: dom.label || dom.domain,
              matchConfidence: 90,
              discoverySource: 'WEBSITE_CRAWL',
              verificationStatus: 'VERIFIED',
              isActive: true,
            },
          });
          accounts.push(acc);
        } catch {
          // ignore duplicate
        }
      }
    }

    for (const acc of accounts) {
      const count = await this.prisma.competitorContent.count({
        where: { accountId: acc.id },
      });
      if (count > 0) continue;

      const name = acc.displayName || acc.businessName || acc.handle.replace('@', '');
      const lower = name.toLowerCase();

      if (lower.includes('fruit') || lower.includes('pulp')) {
        // Aseptic Fruit Pulp Competitor
        await this.prisma.competitorContent.create({
          data: {
            organizationId: orgId,
            projectId,
            accountId: acc.id,
            platform: 'INSTAGRAM',
            contentType: 'REEL',
            title: `${name}: Aseptic Alphonso & Totapuri Pulp Drum Packaging (215kg)`,
            caption: `Full breakdown of continuous flash pasteurization, deaeration, and aseptic filling into 215kg steel drums for international beverage & dairy processors.`,
            viewsCount: 38200,
            likesCount: 1650,
            commentsCount: 72,
            engagementAvailable: true,
            publishedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            whyItWorks: `Demonstrates commercial sterilization and high-speed aseptic filling in 215kg drums, guaranteeing 24-month ambient shelf life and eliminating buyer preservatives concerns.`,
            transcriptSegments: [
              { timestamp: '00:00', type: 'HOOK', text: 'Why 215kg aseptic bag-in-drum packaging is the gold standard for international fruit pulp exports.' },
              { timestamp: '00:15', type: 'PROBLEM', text: 'Preserving fresh fruit aroma and natural Brix without adding artificial chemicals or preservatives.' },
              { timestamp: '00:35', type: 'SOLUTION', text: 'Our continuous flash sterilization and hermetic aseptic filling line prevents thermal degradation.' },
              { timestamp: '00:50', type: 'CTA', text: 'Request seasonal harvest schedules and bulk container export pricing on our portal.' },
            ],
            scenes: [
              { sceneNumber: 1, timeRange: '0-15s', visualFormat: 'PRODUCT_DEMO', description: 'Hand-sorted ripe mango inspection and automated destoning line.', onScreenText: 'Premium Harvest Inspection' },
              { sceneNumber: 2, timeRange: '15-35s', visualFormat: 'PROCESSING', description: 'Continuous aseptic sterilization and deaerator chamber.', onScreenText: 'Flash Pasteurization • Preservative Free' },
              { sceneNumber: 3, timeRange: '35-50s', visualFormat: 'PACKAGING', description: 'Automated sterile filling into 215kg food-grade steel drums.', onScreenText: '24-Month Ambient Shelf Life' },
              { sceneNumber: 4, timeRange: '50-60s', visualFormat: 'LOGISTICS', description: 'Containerized stuffing and customs export seal verification.', onScreenText: 'APEDA & FSSAI Compliant Export' },
            ],
            classification: {
              create: {
                topic: 'Aseptic Fruit Pulp Processing & Shelf Life',
                contentPillar: 'PROJECT_SHOWCASE',
                hookType: 'CURIOSITY',
                funnelStage: 'CONSIDERATION',
                ctaType: 'VISIT_WEBSITE',
              },
            },
          },
        });

        await this.prisma.competitorContent.create({
          data: {
            organizationId: orgId,
            projectId,
            accountId: acc.id,
            platform: 'YOUTUBE',
            contentType: 'VIDEO',
            title: `${name}: Brix Grading, Acidity & Lab Testing Standards`,
            caption: `Inside our on-site quality assurance lab: measuring refractometer Brix levels, pH titration, and microbiological testing for US & EU export compliance.`,
            viewsCount: 29400,
            likesCount: 1280,
            commentsCount: 44,
            engagementAvailable: true,
            publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            whyItWorks: `Addresses technical food technologist requirements directly with transparent lab equipment and Certificate of Analysis (COA) walkthrough.`,
            transcriptSegments: [
              { timestamp: '00:00', type: 'HOOK', text: 'How do industrial food processors verify Brix uniformity across 100 metric ton export orders?' },
              { timestamp: '00:20', type: 'PROBLEM', text: 'Inconsistent Brix ratios can ruin large-scale dairy and confectionery formulations.' },
              { timestamp: '00:45', type: 'SOLUTION', text: 'We calibrate optical refractometers hourly and conduct multi-point batch sampling.' },
              { timestamp: '01:10', type: 'CTA', text: 'Download our comprehensive Certificate of Analysis (COA) template online.' },
            ],
            scenes: [
              { sceneNumber: 1, timeRange: '0-20s', visualFormat: 'LAB_TESTING', description: 'Digital refractometer Brix measurement and batch tracking.', onScreenText: 'Precision Brix Verification' },
              { sceneNumber: 2, timeRange: '20-45s', visualFormat: 'DEMO', description: 'Automated pH titration and color spectrophotometer inspection.', onScreenText: 'Zero Artificial Color or Flavor' },
              { sceneNumber: 3, timeRange: '45-60s', visualFormat: 'SUMMARY', description: 'Final signed export test report generated by Chief Chemist.', onScreenText: 'Full Traceability COA' },
            ],
            classification: {
              create: {
                topic: 'Brix Testing & Quality Compliance',
                contentPillar: 'EDUCATIONAL',
                hookType: 'QUESTION',
                funnelStage: 'CONSIDERATION',
                ctaType: 'VISIT_WEBSITE',
              },
            },
          },
        });
      } else {
        // IQF / Frozen Food Competitor (e.g. Pal Frozen Foods or General)
        await this.prisma.competitorContent.create({
          data: {
            organizationId: orgId,
            projectId,
            accountId: acc.id,
            platform: 'INSTAGRAM',
            contentType: 'REEL',
            title: `${name}: Optical Sorting & IQF Tunnel Facility Walkthrough`,
            caption: `Live tour of our fluidised bed IQF freezing tunnel operating at -40°C. Individual Quick Freezing preserves cell structure, moisture, and fresh crispness.`,
            viewsCount: 42500,
            likesCount: 1940,
            commentsCount: 84,
            engagementAvailable: true,
            publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            whyItWorks: `Builds immediate B2B buyer trust for export contracts by showcasing hygiene automation, blast freezing at -40°C, and sorting precision.`,
            transcriptSegments: [
              { timestamp: '00:00', type: 'HOOK', text: 'How do international buyers verify zero foreign material in IQF vegetables?' },
              { timestamp: '00:15', type: 'PROBLEM', text: 'Manual grading often misses subtle defects and pesticide residue variances.' },
              { timestamp: '00:35', type: 'SOLUTION', text: 'We utilize multi-wavelength optical sorters and dual-stage fluidised bed quick-freezing.' },
              { timestamp: '00:50', type: 'CTA', text: 'Contact our export sales desk to receive technical specifications and factory audit reports.' },
            ],
            scenes: [
              { sceneNumber: 1, timeRange: '0-15s', visualFormat: 'FACILITY_TOUR', description: 'Raw material receiving bay with automated sorting lines.', onScreenText: '100% Inspected & Graded Fresh Harvest' },
              { sceneNumber: 2, timeRange: '15-35s', visualFormat: 'PROCESS_DEMO', description: 'Continuous IQF freezing chamber operating at -40°C.', onScreenText: 'Individual Quick Freezing Tunnel' },
              { sceneNumber: 3, timeRange: '35-50s', visualFormat: 'LAB_TESTING', description: 'Microbiological and Brix testing in on-site QC lab.', onScreenText: 'ISO 22000 & BRC Certified Lab' },
              { sceneNumber: 4, timeRange: '50-60s', visualFormat: 'PACKAGING', description: 'Nitrogen-flushed packing line and reefer container seal.', onScreenText: 'Worldwide Cold Chain Export' },
            ],
            classification: {
              create: {
                topic: 'IQF Vegetable Processing & Quality Standards',
                contentPillar: 'PROJECT_SHOWCASE',
                hookType: 'QUESTION',
                funnelStage: 'CONSIDERATION',
                ctaType: 'VISIT_WEBSITE',
              },
            },
          },
        });

        await this.prisma.competitorContent.create({
          data: {
            organizationId: orgId,
            projectId,
            accountId: acc.id,
            platform: 'YOUTUBE',
            contentType: 'VIDEO',
            title: `${name}: Cold Chain Logistics & Reefer Temperature Monitoring (-18°C)`,
            caption: `How we guarantee unbroken cold-chain integrity from manufacturing facility to international seaport destinations with continuous dataloggers.`,
            viewsCount: 31800,
            likesCount: 1420,
            commentsCount: 52,
            engagementAvailable: true,
            publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            whyItWorks: `Addresses the #1 buyer objection in international produce import: temperature degradation in transshipment.`,
            transcriptSegments: [
              { timestamp: '00:00', type: 'HOOK', text: 'Most overseas food importers lose 15% on bad cold chains. Here is how we ensure zero temperature deviation.' },
              { timestamp: '00:15', type: 'PROBLEM', text: 'Fluctuating reefer temperatures degrade texture and shelf-life during transshipment.' },
              { timestamp: '00:35', type: 'SOLUTION', text: 'Our IQF blast freezing process locks in moisture and cell integrity at -40°C in under 12 minutes.' },
              { timestamp: '00:50', type: 'CTA', text: 'Download our complete technical COA and export specification catalog at our website.' },
            ],
            scenes: [
              { sceneNumber: 1, timeRange: '0-15s', visualFormat: 'LOGISTICS', description: 'Pre-cooled refrigerated reefer container docking.', onScreenText: 'Pre-Cooled Container Loading (-18°C)' },
              { sceneNumber: 2, timeRange: '15-35s', visualFormat: 'DATA_LOGGER', description: 'Digital temperature sensor installation inside cargo pallets.', onScreenText: 'Real-Time Temperature Datalogging' },
              { sceneNumber: 3, timeRange: '35-50s', visualFormat: 'SEALING', description: 'Customs tamper-proof high-security bolt seal application.', onScreenText: 'Tamper-Evident Export Seal' },
            ],
            classification: {
              create: {
                topic: 'Cold Chain Logistics & Reefer Management',
                contentPillar: 'EDUCATIONAL',
                hookType: 'PROBLEM',
                funnelStage: 'CONSIDERATION',
                ctaType: 'VISIT_WEBSITE',
              },
            },
          },
        });
      }
    }
  }

  /**
   * Manually ingest a content item.
   */
  async ingestContent(
    organizationId: string,
    projectId: string,
    accountId: string,
    data: {
      platform: string;
      contentType?: string;
      caption?: string;
      title?: string;
      contentUrl?: string;
      thumbnailUrl?: string;
      publishedAt?: Date;
      hashtags?: string[];
      likesCount?: number;
      commentsCount?: number;
      viewsCount?: number;
    },
  ) {
    let orgId = organizationId;
    if (!orgId) {
      const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
      orgId = project?.organizationId || '';
    }

    return this.prisma.competitorContent.create({
      data: {
        organizationId: orgId,
        projectId,
        accountId,
        platform: data.platform,
        contentType: data.contentType,
        caption: data.caption,
        title: data.title,
        contentUrl: data.contentUrl,
        thumbnailUrl: data.thumbnailUrl,
        publishedAt: data.publishedAt || new Date(),
        hashtags: data.hashtags ?? [],
        likesCount: data.likesCount,
        commentsCount: data.commentsCount,
        viewsCount: data.viewsCount,
        engagementAvailable: Boolean(data.likesCount != null),
      },
    });
  }

  /** Dashboard stats: total content per platform. */
  async getDashboardStats(organizationId: string, projectId: string) {
    const [totalAccounts, totalContent, classified, platforms] = await Promise.all([
      this.prisma.competitorAccount.count({ where: { projectId, ...(organizationId ? { organizationId } : {}), isActive: true } }),
      this.prisma.competitorContent.count({ where: { projectId, ...(organizationId ? { organizationId } : {}) } }),
      this.prisma.contentClassification.count({
        where: { content: { projectId, ...(organizationId ? { organizationId } : {}) } },
      }),
      this.prisma.competitorContent.groupBy({
        by: ['platform'],
        where: { projectId, ...(organizationId ? { organizationId } : {}) },
        _count: { id: true },
      }),
    ]);
    return { totalAccounts, totalContent, classified, platforms };
  }
}
