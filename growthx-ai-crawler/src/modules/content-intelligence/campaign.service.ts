import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class CampaignService {
  private readonly logger = new Logger(CampaignService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listCampaigns(organizationId: string, projectId: string) {
    return this.prisma.campaign.findMany({
      where: { organizationId, projectId },
      include: {
        _count: { select: { calendarItems: true, creatorMatches: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCampaign(organizationId: string, campaignId: string) {
    return this.prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: {
        calendarItems: { orderBy: { scheduledFor: 'asc' } },
        creatorMatches: { include: { creator: true }, orderBy: { matchScore: 'desc' } },
      },
    });
  }

  async createCampaign(
    organizationId: string,
    projectId: string,
    data: {
      name: string;
      objective?: string;
      productFocus?: string;
      targetAudience?: string;
      budget?: number;
      startDate?: Date;
      endDate?: Date;
      platforms?: string[];
      strategyId?: string;
      approvalMode?: string;
    },
  ) {
    return this.prisma.campaign.create({
      data: {
        organizationId,
        projectId,
        name: data.name,
        objective: data.objective,
        productFocus: data.productFocus,
        targetAudience: data.targetAudience,
        budget: data.budget,
        startDate: data.startDate,
        endDate: data.endDate,
        platforms: data.platforms ?? [],
        strategyId: data.strategyId,
        approvalMode: data.approvalMode ?? 'APPROVAL',
        status: 'PLANNING',
      },
    });
  }

  async updateCampaignStatus(organizationId: string, campaignId: string, status: string) {
    return this.prisma.campaign.updateMany({
      where: { id: campaignId, organizationId },
      data: { status },
    });
  }

  async getCampaignStats(organizationId: string, projectId: string) {
    const [total, planning, active, completed] = await Promise.all([
      this.prisma.campaign.count({ where: { organizationId, projectId } }),
      this.prisma.campaign.count({ where: { organizationId, projectId, status: 'PLANNING' } }),
      this.prisma.campaign.count({ where: { organizationId, projectId, status: 'ACTIVE' } }),
      this.prisma.campaign.count({ where: { organizationId, projectId, status: 'COMPLETED' } }),
    ]);
    return { total, planning, active, completed };
  }
}
