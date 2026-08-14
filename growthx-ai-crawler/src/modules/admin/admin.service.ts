import { Injectable } from '@nestjs/common';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
  ) {}

  async getQueueStats() {
    const queues = [
      { name: 'crawl-jobs', queue: this.queueService.crawlJobsQueue },
      { name: 'page-fetch', queue: this.queueService.pageFetchQueue },
    ];

    const stats = [];
    for (const q of queues) {
      if (q.queue) {
        const [active, waiting, completed, failed] = await Promise.all([
          q.queue.getActiveCount(),
          q.queue.getWaitingCount(),
          q.queue.getCompletedCount(),
          q.queue.getFailedCount(),
        ]);
        stats.push({
          name: q.name,
          active,
          waiting,
          completed,
          failed,
          avgTime: 'N/A', // BullMQ doesn't track avg duration natively out of the box without metrics
          status: 'active',
        });
      } else {
        stats.push({
          name: q.name,
          active: 0,
          waiting: 0,
          completed: 0,
          failed: 0,
          avgTime: '0.0s',
          status: 'idle',
        });
      }
    }
    return stats;
  }

  async getApiCosts() {
    // This is a placeholder for actual API cost metrics
    // For now we'll just return standard categories and map db values if needed
    // For now we'll just return standard categories and map db values if needed
    // Assuming 'AI_ANALYSES' and 'AUTO_FIXES' might use tokens.
    // The UI expects: { service, tokens, cost, limit, color }
    
    // As a simple real data integration, we'll return 0s since we don't have a 
    // cost tracking table built, but this structure matches real data expectations.
    return [
      { service: "OpenAI GPT-4o (Content & Meta)", tokens: "0", cost: 0.00, limit: 300, color: "bg-purple-500" },
      { service: "Google Gemini 1.5 Pro (Audit & GEO)", tokens: "0", cost: 0.00, limit: 150, color: "bg-violet-500" },
      { service: "DataForSEO SERP API (Rankings)", tokens: "0 req", cost: 0.00, limit: 200, color: "bg-emerald-500" },
      { service: "Google Search Console / GA4 OAuth", tokens: "0 req", cost: 0.00, limit: 0, color: "bg-amber-500" },
    ];
  }

  async getTenants() {
    const orgs = await this.prisma.organization.findMany({
      include: {
        projects: {
          include: {
            websites: true
          }
        },
        members: {
          include: {
            user: true
          },
          take: 1, // just get one to represent owner
          where: { role: 'OWNER' }
        }
      }
    });

    return orgs.map(org => {
      // Calculate sites
      let totalSites = 0;
      org.projects.forEach(p => {
        totalSites += p.websites.length;
      });

      const ownerEmail = org.members[0]?.user?.email || 'admin@' + org.slug + '.com';

      return {
        id: org.id,
        name: org.name,
        owner: ownerEmail,
        plan: 'Growth', // Real plan would come from entitlements API, hardcoded for now
        sites: totalSites,
        health: 0, 
        quota: 0, 
        status: 'active'
      };
    });
  }
}
