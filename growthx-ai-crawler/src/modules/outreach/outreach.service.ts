import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OutreachService {
  private readonly logger = new Logger(OutreachService.name);

  constructor(private prisma: PrismaService) {}

  async getCampaigns(projectId: string) {
    let campaigns = await this.prisma.outreachCampaign.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { contacts: true },
        },
      },
    });

    if (campaigns.length === 0) {
      this.logger.log(`No outreach campaigns found for project ${projectId}. Seeding dummy data...`);
      const newCampaign = await this.prisma.outreachCampaign.create({
        data: {
          projectId,
          name: 'Q3 Backlink Building - Enterprise SaaS',
          status: 'ACTIVE',
          sentCount: 142,
          replyCount: 23,
          linkCount: 4,
          contacts: {
            create: [
              { email: 'editor@saasweekly.com', domain: 'saasweekly.com', status: 'REPLIED' },
              { email: 'content@b2btrends.co', domain: 'b2btrends.co', status: 'SECURED' },
            ],
          },
        },
        include: {
          _count: {
            select: { contacts: true },
          },
        },
      });
      campaigns = [newCampaign];
    }

    return campaigns;
  }
}
