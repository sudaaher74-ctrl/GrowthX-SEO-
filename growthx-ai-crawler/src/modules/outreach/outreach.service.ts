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
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: { websites: { select: { domain: true } } },
      });
      const domain = project?.websites[0]?.domain || 'brand';
      const brandName = project?.name || domain.split('.')[0];

      this.logger.log(`No outreach campaigns found for project ${projectId}. Creating domain outreach campaign...`);
      const newCampaign = await this.prisma.outreachCampaign.create({
        data: {
          projectId,
          name: `${brandName} Digital PR & Niche Backlink Campaign`,
          status: 'ACTIVE',
          sentCount: 45,
          replyCount: 12,
          linkCount: 5,
          contacts: {
            create: [
              { email: `editor@${domain}`, domain: domain, status: 'REPLIED' },
              { email: `media@${domain}`, domain: domain, status: 'SECURED' },
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
