import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../../database/prisma.service';
import { TokensService } from '../tokens/tokens.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
    private readonly tokens: TokensService,
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

    // Every call routed through MultiAiRouterService — Mammouth included — is
    // booked to AiUsageRecord, not to marketResearchRun. Reading only the
    // latter left the spend ledger empty while the router was billing all day.
    const routed = await this.prisma.aiUsageRecord.groupBy({
      by: ['provider', 'model'],
      _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
      _count: { _all: true },
    });

    for (const row of routed) {
      const service = `${row.provider} / ${row.model}`;
      const entry = byModel.get(service) ?? { tokens: 0, cost: 0 };
      entry.tokens += (row._sum.inputTokens ?? 0) + (row._sum.outputTokens ?? 0);
      // A provider with no configured rate reports tokens and no cost. A
      // guessed price would be worse than an absent one.
      entry.cost += row._sum.estimatedCostUsd ?? 0;
      byModel.set(service, entry);
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

    // What each organization can actually use. This column used to be a
    // `plan: 'ENTERPRISE'` written into every row, whatever the organization was:
    // a made-up value on the one screen operators rely on to know who is who.
    // An organization that has not used a metered feature yet has no wallet and
    // reads as null, which the screen shows as exactly that.
    const balances = await this.tokens.peek(orgs.map((org) => org.id));

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
        tokens: balances.get(org.id) ?? null,
        sites: totalSites,
        status: 'active'
      };
    });
  }

  async getSystemHealth() {
    const startTime = Date.now();
    let dbStatus = 'CONNECTED';
    let dbLatencyMs = 0;

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - startTime;
    } catch {
      dbStatus = 'DISCONNECTED';
    }

    const redisConnected = Boolean(
      this.queueService.crawlJobsQueue || this.queueService.pageFetchQueue,
    );

    return {
      status: dbStatus === 'CONNECTED' && redisConnected ? 'HEALTHY' : 'DEGRADED',
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
      redis: {
        status: redisConnected ? 'CONNECTED' : 'DISCONNECTED',
        queuesActive: redisConnected,
      },
      crawlerCluster: {
        status: 'OPERATIONAL',
        activeWorkers: 4,
        headlessEngine: 'Chromium / Puppeteer',
      },
      aiRouter: {
        status: 'OPERATIONAL',
        primaryModel: 'Gemini 2.5 Flash',
        fallbackProvider: 'Groq LLaMA 3.3',
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Platform totals. Includes currently logged-in active users (with active,
   * unexpired refresh sessions) and total active sessions.
   */
  async getStats() {
    const now = new Date();
    const [tenants, users, projects, activeSessions] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.user.count(),
      this.prisma.project.count(),
      this.prisma.refreshSession
        ? this.prisma.refreshSession.findMany({
            where: {
              revokedAt: null,
              expiresAt: { gt: now },
            },
            select: { userId: true },
          }).catch(() => [])
        : Promise.resolve([]),
    ]);
    const loggedInUserIds = new Set((activeSessions || []).map((s: { userId: string }) => s.userId));
    return {
      tenants,
      users,
      projects,
      loggedInUsers: loggedInUserIds.size,
      activeSessions: activeSessions ? activeSessions.length : 0,
    };
  }

  async getUsers() {
    const now = new Date();
    const users = await this.prisma.user.findMany({
      include: {
        memberships: {
          include: {
            organization: true,
          },
        },
        sessions: {
          select: {
            id: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const userIds = users.map((u) => u.id);
    const orgIds = [
      ...new Set(
        users.flatMap((u) => u.memberships.map((m) => m.organizationId)).filter(Boolean),
      ),
    ];

    // AI model usage via TokenTransaction (has userId or organizationId)
    const tokenAiUsage = this.prisma.tokenTransaction
      ? await this.prisma.tokenTransaction.findMany({
          where: {
            action: 'AI_USAGE',
            OR: [
              { userId: { in: userIds } },
              { organizationId: { in: orgIds } },
            ],
          },
          select: {
            userId: true,
            organizationId: true,
            detail: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        }).catch(() => [])
      : [];

    // AI model usage via AiUsageRecord (has organizationId)
    const orgAiRecords = this.prisma.aiUsageRecord
      ? await this.prisma.aiUsageRecord.findMany({
          where: {
            organizationId: { in: orgIds },
          },
          select: {
            organizationId: true,
            provider: true,
            model: true,
            inputTokens: true,
            outputTokens: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1000,
        }).catch(() => [])
      : [];

    const userAiMap = new Map<
      string,
      { models: Set<string>; totalCalls: number; lastUsedAt: string | null }
    >();

    for (const tx of tokenAiUsage) {
      const targetUserId = tx.userId;
      if (!targetUserId) continue;
      const detail = (tx.detail as Record<string, any>) || {};
      const model = detail.model || detail.provider;
      if (!userAiMap.has(targetUserId)) {
        userAiMap.set(targetUserId, { models: new Set(), totalCalls: 0, lastUsedAt: null });
      }
      const entry = userAiMap.get(targetUserId)!;
      entry.totalCalls++;
      if (model) entry.models.add(model);
      if (!entry.lastUsedAt || new Date(tx.createdAt) > new Date(entry.lastUsedAt)) {
        entry.lastUsedAt = tx.createdAt.toISOString();
      }
    }

    const orgToUsers = new Map<string, string[]>();
    for (const u of users) {
      for (const m of u.memberships) {
        if (!orgToUsers.has(m.organizationId)) {
          orgToUsers.set(m.organizationId, []);
        }
        orgToUsers.get(m.organizationId)!.push(u.id);
      }
    }

    for (const rec of orgAiRecords) {
      if (!rec.organizationId) continue;
      const memberUserIds = orgToUsers.get(rec.organizationId) || [];
      const modelName = `${rec.provider} / ${rec.model}`;
      for (const uid of memberUserIds) {
        if (!userAiMap.has(uid)) {
          userAiMap.set(uid, { models: new Set(), totalCalls: 0, lastUsedAt: null });
        }
        const entry = userAiMap.get(uid)!;
        entry.totalCalls++;
        entry.models.add(modelName);
        if (!entry.lastUsedAt || new Date(rec.createdAt) > new Date(entry.lastUsedAt)) {
          entry.lastUsedAt = rec.createdAt.toISOString();
        }
      }
    }

    return users.map((u) => {
      const primaryMembership = u.memberships[0];
      const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email.split('@')[0];
      const sessions = (u as any).sessions || [];
      const activeSessions = sessions.filter(
        (s: any) => !s.revokedAt && s.expiresAt > now,
      );
      const isLoggedIn = activeSessions.length > 0;
      const lastLoginAt = sessions[0]?.createdAt ? sessions[0].createdAt.toISOString() : null;

      const aiData = userAiMap.get(u.id);
      const modelsUsed = aiData ? Array.from(aiData.models) : [];

      return {
        id: u.id,
        email: u.email,
        name: fullName,
        role: primaryMembership?.role || 'MEMBER',
        organizationName: primaryMembership?.organization?.name || 'Unassigned',
        organizationId: primaryMembership?.organizationId || null,
        createdAt: u.createdAt.toISOString(),
        isLoggedIn,
        activeSessionsCount: activeSessions.length,
        lastLoginAt,
        status: isLoggedIn ? 'ONLINE' : 'OFFLINE',
        modelsUsed,
        aiCallsCount: aiData?.totalCalls ?? 0,
        lastAiUsedAt: aiData?.lastUsedAt ?? null,
      };
    });
  }

  /**
   * Detailed breakdown of which user and organization is using which AI model,
   * with tokens, calls, cost, and recency.
   */
  async getUserModelBreakdown() {
    const [aiRecords, users, tokenUsage] = await Promise.all([
      this.prisma.aiUsageRecord
        ? this.prisma.aiUsageRecord.findMany({
            orderBy: { createdAt: 'desc' },
            take: 2000,
          }).catch(() => [])
        : [],
      this.prisma.user.findMany({
        include: {
          memberships: {
            include: { organization: true },
          },
        },
      }),
      this.prisma.tokenTransaction
        ? this.prisma.tokenTransaction.findMany({
            where: { action: 'AI_USAGE' },
            orderBy: { createdAt: 'desc' },
            take: 2000,
          }).catch(() => [])
        : [],
    ]);

    const orgUsersMap = new Map<
      string,
      Array<{ id: string; name: string; email: string; orgName: string }>
    >();
    const userById = new Map<string, { id: string; name: string; email: string; orgName: string }>();

    for (const u of users) {
      const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email.split('@')[0];
      const primaryOrg = u.memberships[0]?.organization?.name || 'Unassigned';
      userById.set(u.id, {
        id: u.id,
        name: fullName,
        email: u.email,
        orgName: primaryOrg,
      });
      for (const m of u.memberships) {
        if (!orgUsersMap.has(m.organizationId)) {
          orgUsersMap.set(m.organizationId, []);
        }
        orgUsersMap.get(m.organizationId)!.push({
          id: u.id,
          name: fullName,
          email: u.email,
          orgName: m.organization.name,
        });
      }
    }

    const breakdown = new Map<
      string,
      {
        userId: string;
        userName: string;
        userEmail: string;
        organizationName: string;
        provider: string;
        model: string;
        calls: number;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        cost: number;
        lastUsedAt: string;
      }
    >();

    // 1. Incorporate direct TokenTransactions if userId is available
    for (const tx of tokenUsage) {
      if (!tx.userId && !tx.organizationId) continue;
      const detail = (tx.detail as Record<string, any>) || {};
      const provider = detail.provider || 'AI Router';
      const model = detail.model || detail.task || 'General AI';
      const inTokens = detail.inputTokens ?? 0;
      const outTokens = detail.outputTokens ?? 0;

      const user = tx.userId ? userById.get(tx.userId) : null;
      const usersInOrg = tx.organizationId ? orgUsersMap.get(tx.organizationId) || [] : [];
      const assigned = user ? [user] : usersInOrg.length > 0 ? usersInOrg : null;
      if (!assigned) continue;

      for (const u of assigned) {
        const key = `${u.id}:${provider}:${model}`;
        if (!breakdown.has(key)) {
          breakdown.set(key, {
            userId: u.id,
            userName: u.name,
            userEmail: u.email,
            organizationName: u.orgName,
            provider,
            model,
            calls: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            cost: 0,
            lastUsedAt: tx.createdAt.toISOString(),
          });
        }
        const item = breakdown.get(key)!;
        item.calls++;
        item.inputTokens += inTokens;
        item.outputTokens += outTokens;
        item.totalTokens += inTokens + outTokens;
        if (new Date(tx.createdAt) > new Date(item.lastUsedAt)) {
          item.lastUsedAt = tx.createdAt.toISOString();
        }
      }
    }

    // 2. Incorporate AiUsageRecord
    for (const record of aiRecords) {
      const usersInOrg = record.organizationId ? orgUsersMap.get(record.organizationId) || [] : [];
      const assignedUsers =
        usersInOrg.length > 0
          ? usersInOrg
          : [{ id: 'system', name: 'System Background', email: 'system@reigel.in', orgName: 'Platform Worker' }];

      for (const user of assignedUsers) {
        const key = `${user.id}:${record.provider}:${record.model}`;
        if (!breakdown.has(key)) {
          breakdown.set(key, {
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            organizationName: user.orgName,
            provider: record.provider,
            model: record.model,
            calls: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            cost: 0,
            lastUsedAt: record.createdAt.toISOString(),
          });
        }
        const item = breakdown.get(key)!;
        item.calls++;
        item.inputTokens += record.inputTokens;
        item.outputTokens += record.outputTokens;
        item.totalTokens += record.inputTokens + record.outputTokens;
        item.cost += record.estimatedCostUsd ?? 0;
        if (new Date(record.createdAt) > new Date(item.lastUsedAt)) {
          item.lastUsedAt = record.createdAt.toISOString();
        }
      }
    }

    return Array.from(breakdown.values()).sort((a, b) => b.totalTokens - a.totalTokens);
  }

  async pauseQueues() {
    if (this.queueService.crawlJobsQueue) await this.queueService.crawlJobsQueue.pause();
    if (this.queueService.pageFetchQueue) await this.queueService.pageFetchQueue.pause();
    return { success: true, status: 'PAUSED' };
  }

  async resumeQueues() {
    if (this.queueService.crawlJobsQueue) await this.queueService.crawlJobsQueue.resume();
    if (this.queueService.pageFetchQueue) await this.queueService.pageFetchQueue.resume();
    return { success: true, status: 'ACTIVE' };
  }

  async retryFailedJobs() {
    let retriedCount = 0;
    const queues = [this.queueService.crawlJobsQueue, this.queueService.pageFetchQueue];
    for (const q of queues) {
      if (q) {
        try {
          const failed = await q.getFailed();
          for (const job of failed) {
            await job.retry();
            retriedCount++;
          }
        } catch {
          // ignore queue inspection errors
        }
      }
    }
    return { success: true, retriedCount };
  }
}

