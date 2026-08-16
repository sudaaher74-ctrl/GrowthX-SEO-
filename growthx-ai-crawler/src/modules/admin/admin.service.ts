import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../../database/prisma.service';
import { EntitlementsService } from '../billing/entitlements.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
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

  /**
   * Real model spend, grouped by the model that actually ran.
   *
   * This used to return a fixed list of vendors with zeroes against them,
   * naming services the deployment may not even use. Market research runs
   * record their own per-step usage and cost, so the figures come from there;
   * an empty list means nothing has been spent yet, which is the truth.
   */
  async getApiCosts() {
    const runs = await this.prisma.marketResearchRun.findMany({
      where: { modelUsage: { not: Prisma.DbNull } },
      select: { modelUsage: true, inputTokens: true, outputTokens: true },
      orderBy: { startedAt: 'desc' },
      take: 1000,
    });

    const byModel = new Map<string, { tokens: number; cost: number }>();
    for (const run of runs) {
      const steps = Array.isArray(run.modelUsage) ? (run.modelUsage as any[]) : [];
      for (const step of steps) {
        if (!step?.model) continue;
        const entry = byModel.get(step.model) ?? { tokens: 0, cost: 0 };
        entry.tokens += (step.inputTokens ?? 0) + (step.outputTokens ?? 0);
        // Providers that do not report a cost contribute tokens only; a guessed
        // price would be worse than an absent one.
        entry.cost += typeof step.costUsd === 'number' ? step.costUsd : 0;
        byModel.set(step.model, entry);
      }
    }

    return [...byModel.entries()]
      .sort((a, b) => b[1].tokens - a[1].tokens)
      .map(([service, totals]) => ({
        service,
        tokens: totals.tokens.toLocaleString(),
        cost: Number(totals.cost.toFixed(4)),
      }));
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

    // Each org's real plan, resolved through the billing layer rather than
    // assumed. Previously every tenant was reported as "Growth".
    const planByOrg = new Map<string, string>();
    for (const org of orgs) {
      try {
        const { plan } = await this.entitlements.resolvePlan(org.id);
        planByOrg.set(org.id, plan);
      } catch {
        planByOrg.set(org.id, 'FREE');
      }
    }

    return orgs.map(org => {
      // Calculate sites
      let totalSites = 0;
      org.projects.forEach(p => {
        totalSites += p.websites.length;
      });

      // No invented address: an org with no owner on record shows none.
      const ownerEmail = org.members[0]?.user?.email ?? null;

      return {
        id: org.id,
        name: org.name,
        owner: ownerEmail,
        plan: planByOrg.get(org.id) ?? 'FREE',
        sites: totalSites,
        status: 'active'
      };
    });
  }
}
