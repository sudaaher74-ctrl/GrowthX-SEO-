import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Backlink } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { BacklinkFetcher } from "./backlink-fetcher.service";
import {
  absenceState,
  belongsTo,
  DAY,
  evidenceHash,
  extractBacklinks,
  hostOf,
  kindOf,
  linkUrl,
  MAX_SOURCES,
  parseImport,
} from "./backlink-evidence";

export type Readiness = {
  state: "READY" | "NEEDS_FIX" | "UNKNOWN";
  reason: string;
  checkedAt: Date | null;
};

@Injectable()
export class BacklinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fetcher: BacklinkFetcher,
  ) {}

  async context(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        organizationId: true,
        websites: { select: { domain: true } },
        competitors: { select: { domain: true } },
      },
    });
    if (!project) throw new NotFoundException("Project not found.");
    const hosts = (items: { domain: string }[]) =>
      items.flatMap((item) => {
        try {
          return [hostOf(item.domain)];
        } catch {
          return [];
        }
      });
    return {
      organizationId: project.organizationId,
      own: hosts(project.websites),
      competitors: hosts(project.competitors),
    };
  }

  async import(projectId: string, text: string, discovery = "MANUAL") {
    const context = await this.context(projectId);
    if (!context.own.length)
      throw new BadRequestException(
        "Add your own website to this project before importing links.",
      );
    let rows: Array<{ sourceUrl: string; targetUrl?: string }>;
    try {
      rows = parseImport(text).map((row, index) => {
        try {
          const sourceUrl = linkUrl(row.sourceUrl);
          if (belongsTo(hostOf(sourceUrl), context.own))
            throw new Error("Source must be an external website.");
          const targetUrl = row.targetUrl ? linkUrl(row.targetUrl) : undefined;
          if (targetUrl && !kindOf(targetUrl, context.own, context.competitors))
            throw new Error(
              "Destination must belong to this project or a saved competitor.",
            );
          return { sourceUrl, targetUrl };
        } catch (error) {
          throw new Error(`Row ${index + 1}: ${(error as Error).message}`);
        }
      });
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    // Serializable makes the project cap hold even across simultaneous imports.
    return this.prisma.$transaction(
      async (tx) => {
        let added = 0;
        for (const row of rows) {
          const existing = await tx.backlinkSource.findUnique({
            where: {
              projectId_sourceUrl: { projectId, sourceUrl: row.sourceUrl },
            },
          });
          const source =
            existing ??
            (await tx.backlinkSource.create({
              data: {
                projectId,
                sourceUrl: row.sourceUrl,
                origin: new URL(row.sourceUrl).origin,
                discovery,
              },
            }));
          if (!existing) added++;
          if (row.targetUrl)
            await tx.backlink.upsert({
              where: {
                sourceId_targetUrl: {
                  sourceId: source.id,
                  targetUrl: row.targetUrl,
                },
              },
              update: {},
              create: {
                sourceId: source.id,
                targetUrl: row.targetUrl,
                targetHost: hostOf(row.targetUrl),
                targetKind: kindOf(
                  row.targetUrl,
                  context.own,
                  context.competitors,
                )!,
              },
            });
          if (
            (await tx.backlink.count({ where: { sourceId: source.id } })) > 500
          )
            throw new BadRequestException(
              "Monitor at most 500 destinations per source page.",
            );
        }
        if (
          (await tx.backlinkSource.count({ where: { projectId } })) >
          MAX_SOURCES
        )
          throw new BadRequestException(
            `This project can monitor up to ${MAX_SOURCES} source pages.`,
          );
        return {
          added,
          submitted: rows.length,
          duplicates: rows.length - added,
          message:
            "Saved as candidates. Verification discovers links to your site and saved competitors.",
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 30_000,
      },
    );
  }

  /** Discover only from this project's scoped crawl evidence; never other tenants' crawls. */
  async discover(projectId: string) {
    const context = await this.context(projectId);
    const jobs = await this.prisma.crawlJob.findMany({
      where: {
        status: "COMPLETED",
        website: { OR: [{ projectId }, { scope: `competitor:${projectId}` }] },
      },
      distinct: ["websiteId"],
      orderBy: { finishedAt: "desc" },
      take: 10,
      select: { id: true },
    });
    if (!jobs.length)
      return {
        added: 0,
        inspected: 0,
        message: "Complete a website or competitor crawl first.",
      };
    const links = await this.prisma.link.findMany({
      where: {
        linkType: "EXTERNAL",
        sourcePage: { crawlJobId: { in: jobs.map((job) => job.id) } },
      },
      take: 5000,
      orderBy: { id: "asc" },
      select: { targetUrl: true, sourcePage: { select: { finalUrl: true } } },
    });
    const sources = new Map<string, { sourceUrl: string; targetUrl: string }>();
    for (const link of links) {
      try {
        const sourceUrl = linkUrl(link.sourcePage.finalUrl),
          targetUrl = linkUrl(link.targetUrl);
        if (
          !belongsTo(hostOf(sourceUrl), context.own) &&
          kindOf(targetUrl, context.own, context.competitors)
        )
          sources.set(sourceUrl, { sourceUrl, targetUrl });
      } catch {
        /* invalid historical URLs do not prevent discovery */
      }
      if (sources.size >= 200) break;
    }
    if (!sources.size)
      return {
        added: 0,
        inspected: links.length,
        message:
          "No external referring pages found in these crawls. Import source URLs or a Search Console Links CSV to expand coverage.",
      };
    const csv = [
      "sourceUrl,targetUrl",
      ...[...sources.values()].map(
        (r) => `${JSON.stringify(r.sourceUrl)},${JSON.stringify(r.targetUrl)}`,
      ),
    ].join("\n");
    return {
      ...(await this.import(projectId, csv, "PROJECT_CRAWL")),
      inspected: links.length,
    };
  }

  async readiness(
    projectId: string,
    urls: string[],
  ): Promise<Map<string, Readiness>> {
    const result = new Map<string, Readiness>();
    const unique = [...new Set(urls)];
    if (!unique.length) return result;
    const pages = await this.prisma.page.findMany({
      where: {
        crawlJob: { status: "COMPLETED", website: { projectId } },
        OR: [{ url: { in: unique } }, { finalUrl: { in: unique } }],
      },
      distinct: ["url"],
      orderBy: { crawledAt: "desc" },
      take: 1000,
      select: {
        url: true,
        finalUrl: true,
        statusCode: true,
        indexability: true,
        blockedSuspected: true,
        crawledAt: true,
        canonicalUrl: true,
      },
    });
    for (const url of unique) {
      const page = pages.find((p) => p.url === url || p.finalUrl === url);
      let state: Readiness["state"] = "UNKNOWN",
        reason =
          "Run a website audit to check this destination before seeking more links.";
      if (page) {
        if (Date.now() - page.crawledAt.getTime() > 7 * DAY)
          reason =
            "Destination audit is over seven days old. Re-audit before acting.";
        else if (page.blockedSuspected || !page.statusCode)
          reason = "The audit could not reliably inspect this destination.";
        else if (
          page.statusCode >= 400 ||
          page.indexability === "NOT_INDEXABLE"
        ) {
          state = "NEEDS_FIX";
          reason = `Latest audit: HTTP ${page.statusCode}, indexability ${page.indexability}. Fix and re-audit before link building.`;
        } else if (
          page.statusCode === 200 &&
          page.indexability === "INDEXABLE"
        ) {
          state = "READY";
          reason =
            "Latest audit found an accessible, indexable destination. This does not prove Google indexed it.";
        } else
          reason =
            "Latest audit does not establish an accessible, indexable destination.";
      }
      result.set(url, { state, reason, checkedAt: page?.crawledAt ?? null });
    }
    return result;
  }

  async verifySource(projectId: string, sourceId: string) {
    const source = await this.prisma.backlinkSource.findFirst({
      where: { id: sourceId, projectId },
      include: { links: true },
    });
    if (!source) return;
    // A crash/retry or rapid repeated button click must not manufacture observations.
    if (
      source.lastAttemptAt &&
      Date.now() - source.lastAttemptAt.getTime() < 10 * 60_000
    ) {
      // A retry after the observation committed must still finish task reconciliation.
      await this.syncSourceActions(projectId, sourceId);
      return;
    }
    const context = await this.context(projectId);
    const result = await this.fetcher.fetch(source.sourceUrl);
    const now = new Date();
    let found: ReturnType<typeof extractBacklinks> = [];
    try {
      if (result.outcome === "READ")
        found = extractBacklinks(
          result.html!,
          result.finalUrl!,
          context.own,
          context.competitors,
        );
    } catch (error) {
      result.outcome = "UNKNOWN";
      result.reason = (error as Error).message;
    }
    if (
      new Set([
        ...source.links.map((link) => link.targetUrl),
        ...found.map((link) => link.targetUrl),
      ]).size > 500
    ) {
      found = [];
      result.outcome = "UNKNOWN";
      result.reason =
        "This source exceeds the 500-destination monitoring budget; absence cannot be established.";
    }
    await this.prisma.$transaction(
      async (tx) => {
        // Atomically claim this observation: even two deliveries cannot append it twice.
        const claimed = await tx.backlinkSource.updateMany({
          where: {
            id: sourceId,
            projectId,
            OR: [
              { lastAttemptAt: null },
              { lastAttemptAt: { lt: new Date(now.getTime() - 10 * 60_000) } },
            ],
          },
          data: {
            lastAttemptAt: now,
            status: result.outcome,
            nextCheckAt: new Date(
              now.getTime() + (result.outcome === "READ" ? 7 * DAY : DAY),
            ),
          },
        });
        if (!claimed.count) return;
        await tx.backlinkObservation.create({
          data: {
            sourceId,
            checkedAt: now,
            outcome: result.outcome,
            statusCode: result.statusCode,
            finalUrl: result.finalUrl,
            reason: result.reason,
            contentHash: result.html ? evidenceHash(result.html) : undefined,
            evidence: found as unknown as Prisma.InputJsonValue,
          },
        });
        const retained = await tx.backlinkObservation.findMany({
          where: { sourceId },
          orderBy: { checkedAt: "desc" },
          take: 30,
          select: { id: true },
        });
        await tx.backlinkObservation.deleteMany({
          where: { sourceId, id: { notIn: retained.map((item) => item.id) } },
        });
        const destinations = new Map<string, (typeof found)[number]>();
        for (const link of found) {
          const previous = destinations.get(link.targetUrl);
          destinations.set(
            link.targetUrl,
            previous
              ? {
                  ...previous,
                  rel: [...new Set([...previous.rel, ...link.rel])],
                }
              : link,
          );
        }
        for (const link of destinations.values())
          await tx.backlink.upsert({
            where: {
              sourceId_targetUrl: { sourceId, targetUrl: link.targetUrl },
            },
            create: {
              ...link,
              sourceId,
              status: "VERIFIED",
              firstObservedAt: now,
              lastVerifiedAt: now,
            },
            update: {
              ...link,
              status: "VERIFIED",
              firstObservedAt:
                source.links.find((old) => old.targetUrl === link.targetUrl)
                  ?.firstObservedAt ?? now,
              lastVerifiedAt: now,
              firstMissingAt: null,
              missingChecks: 0,
            },
          });
        const present = new Set(found.map((link) => link.targetUrl));
        for (const link of source.links) {
          if (present.has(link.targetUrl)) continue;
          if (!kindOf(link.targetUrl, context.own, context.competitors)) {
            await tx.backlink.update({
              where: { id: link.id },
              data: { status: "OUT_OF_SCOPE" },
            });
            continue;
          }
          const data =
            result.outcome === "READ" || result.outcome === "ABSENT"
              ? absenceState(link, now)
              : {
                  status: result.outcome === "BLOCKED" ? "BLOCKED" : "UNKNOWN",
                };
          await tx.backlink.update({ where: { id: link.id }, data });
        }
      },
      { timeout: 30_000 },
    );
    await this.syncSourceActions(projectId, sourceId);
    return result;
  }

  /** The user reviews relevance and chooses a business page; no automatic outreach. */
  async plan(projectId: string, sourceId: string, target: string) {
    const context = await this.context(projectId);
    let targetUrl: string;
    try {
      targetUrl = linkUrl(target);
      if (kindOf(targetUrl, context.own, context.competitors) !== "OWN")
        throw new Error("Choose a destination on your own website.");
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    const source = await this.prisma.backlinkSource.findFirst({
      where: { id: sourceId, projectId },
      include: { links: true },
    });
    if (!source) throw new NotFoundException("Source page not found.");
    const fresh =
      source.status === "READ" &&
      source.links.some(
        (link) =>
          link.targetKind === "COMPETITOR" &&
          link.status === "VERIFIED" &&
          link.lastVerifiedAt &&
          Date.now() - link.lastVerifiedAt.getTime() <= 7 * DAY,
      );
    if (!fresh)
      throw new BadRequestException(
        "Verify this source and its competitor link before planning an action.",
      );
    const link = await this.prisma.$transaction(
      async (tx) => {
        const candidate = await tx.backlink.upsert({
          where: { sourceId_targetUrl: { sourceId, targetUrl } },
          update: {},
          create: {
            sourceId,
            targetUrl,
            targetHost: hostOf(targetUrl),
            targetKind: "OWN",
          },
        });
        if ((await tx.backlink.count({ where: { sourceId } })) > 500)
          throw new BadRequestException(
            "Monitor at most 500 destinations per source page.",
          );
        return candidate;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    const destination = (await this.readiness(projectId, [targetUrl])).get(
      targetUrl,
    )!;
    if (link.status === "VERIFIED")
      throw new BadRequestException(
        "This destination already has a verified link from this source.",
      );
    await this.syncPlan(
      context.organizationId,
      projectId,
      link,
      source.sourceUrl,
      destination,
    );
    return {
      message:
        destination.state === "READY"
          ? "Plan saved to Opportunities. Review the publisher’s requirements; verify the source again after completing the action."
          : "Plan saved with a destination prerequisite. Complete and verify the website audit before pursuing this link.",
    };
  }

  private async syncPlan(
    organizationId: string,
    projectId: string,
    link: Backlink,
    sourceUrl: string,
    destination: Readiness,
  ) {
    const ready = destination.state === "READY";
    await this.syncAction(
      organizationId,
      projectId,
      link,
      sourceUrl,
      "earn",
      link.status !== "VERIFIED",
      link.status === "VERIFIED",
      ready
        ? "Review a relevant publisher for your business page"
        : "Prepare your destination before pursuing this link",
      ready
        ? "You reviewed this source for relevance. Review its editorial or listing requirements and complete the action yourself. Verify the page afterward; a competitor link does not guarantee acceptance."
        : `${destination.reason} Once the destination is ready, review the publisher’s requirements.`,
      ready ? 60 : 70,
      destination.checkedAt,
    );
  }

  private async syncSourceActions(projectId: string, sourceId: string) {
    const source = await this.prisma.backlinkSource.findFirst({
      where: { id: sourceId, projectId },
      include: { links: true },
    });
    if (!source) return;
    const context = await this.context(projectId);
    const { organizationId } = context;
    const own = source.links.filter(
      (link) =>
        link.targetKind === "OWN" &&
        kindOf(link.targetUrl, context.own, context.competitors) === "OWN",
    );
    const ready = await this.readiness(
      projectId,
      own.map((link) => link.targetUrl),
    );
    const plans = await this.prisma.growthOpportunity.findMany({
      where: {
        projectId,
        source: "BACKLINKS",
        detailRef: sourceId,
        fingerprint: { startsWith: "backlinks:earn:" },
      },
      select: { fingerprint: true },
    });
    const planned = new Set(plans.map((plan) => plan.fingerprint));
    for (const link of own) {
      const destination = ready.get(link.targetUrl)!;
      await this.syncAction(
        organizationId,
        projectId,
        link,
        source.sourceUrl,
        "repair",
        link.status === "VERIFIED" && destination.state === "NEEDS_FIX",
        link.status === "VERIFIED" && destination.state === "READY",
        "Repair a destination with a verified backlink",
        destination.reason,
        90,
        destination.checkedAt,
      );
      await this.syncAction(
        organizationId,
        projectId,
        link,
        source.sourceUrl,
        "recover",
        link.status === "LOST",
        link.status === "VERIFIED",
        "Recover a confirmed missing backlink",
        destination.state === "READY"
          ? "Compare the source history, review the changed page, and consider requesting restoration of a useful link."
          : `Check the destination first. ${destination.reason} Then review the source before requesting restoration.`,
        80,
        destination.checkedAt,
      );
      if (planned.has(`backlinks:earn:${link.id}`))
        await this.syncPlan(
          organizationId,
          projectId,
          link,
          source.sourceUrl,
          destination,
        );
    }
  }

  private async syncAction(
    organizationId: string,
    projectId: string,
    link: Backlink,
    sourceUrl: string,
    kind: string,
    active: boolean,
    resolved: boolean,
    title: string,
    action: string,
    priority: number,
    checkedAt: Date | null,
  ) {
    const fingerprint = `backlinks:${kind}:${link.id}`;
    if (active) {
      const evidence = [
        {
          label: "Referring page",
          value: sourceUrl,
          source: "Backlink HTML verification",
        },
        {
          label: "Destination",
          value: link.targetUrl,
          source: "Backlink HTML verification",
        },
        {
          label: "Last verified present",
          value: link.lastVerifiedAt?.toISOString() ?? "Not verified",
          source: "Backlink history",
        },
        {
          label: "Destination audit",
          value: checkedAt?.toISOString() ?? "Not measured",
          source: "Website audit",
        },
        ...(kind === "recover"
          ? [
              {
                label: "First successful absence check",
                value: link.firstMissingAt?.toISOString() ?? "Not measured",
                source: "Backlink history",
              },
              {
                label: "Successful absence checks",
                value: String(link.missingChecks),
                source: "Backlink history",
              },
            ]
          : []),
      ];
      await this.prisma.growthOpportunity.upsert({
        where: { projectId_fingerprint: { projectId, fingerprint } },
        create: {
          organizationId,
          projectId,
          fingerprint,
          source: "BACKLINKS",
          category: kind === "repair" ? "TECHNICAL" : "SEO",
          title,
          summary:
            kind === "repair"
              ? "A verified external link points to a destination that needs attention."
              : kind === "earn"
                ? "You selected this destination after reviewing an observed competitor source. Readiness is checked before recommending action."
                : "A previously verified link was absent on successful checks at least 24 hours apart.",
          evidence,
          recommendedAction: action,
          potential: kind === "earn" ? "MEDIUM" : "HIGH",
          effort: kind === "repair" ? "LOW" : "MEDIUM",
          confidence: kind === "earn" ? 60 : 90,
          priority,
          impact: priority,
          affectedPages: [link.targetUrl],
          affectedCount: 1,
          detailType: "BACKLINK",
          detailRef: link.sourceId,
          lifecycle: "QUEUED",
          transitions: [
            {
              from: "DETECTED",
              to: "QUEUED",
              at: new Date().toISOString(),
              actor: { type: "SYSTEM" },
              reason: "BACKLINKS: evidence-backed action detected",
            },
          ],
        },
        update: {
          title,
          evidence,
          recommendedAction: action,
          priority,
          impact: priority,
          lastSeenAt: new Date(),
        },
      });
      // A transient block cannot reopen an earned-link plan as confirmed loss.
      if (kind !== "earn" || link.status === "LOST")
        await this.systemTransition(projectId, fingerprint, "QUEUED");
    } else if (resolved) {
      await this.systemTransition(projectId, fingerprint, "RESOLVED");
    }
  }

  private async systemTransition(
    projectId: string,
    fingerprint: string,
    to: "QUEUED" | "RESOLVED",
  ) {
    const existing = await this.prisma.growthOpportunity.findUnique({
      where: { projectId_fingerprint: { projectId, fingerprint } },
    });
    if (
      !existing ||
      existing.lifecycle === to ||
      ["DISMISSED", "SNOOZED"].includes(existing.lifecycle) ||
      existing.status === "DISMISSED"
    )
      return;
    const transitions = Array.isArray(existing.transitions)
      ? (existing.transitions as Array<Prisma.JsonObject>)
      : [];
    const last = transitions[transitions.length - 1];
    if (
      to === "QUEUED" &&
      (existing.lifecycle !== "RESOLVED" ||
        last?.reason !== "BACKLINKS: verified resolution")
    )
      return;
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.growthOpportunity.updateMany({
        where: {
          id: existing.id,
          lifecycle: existing.lifecycle,
          lastTransitionAt: existing.lastTransitionAt,
        },
        data: {
          lifecycle: to,
          status: to === "QUEUED" ? "OPEN" : "ACTIONED",
          resolvedAt: to === "RESOLVED" ? now : null,
          lastTransitionAt: now,
          transitions: [
            ...transitions.slice(-99),
            {
              from: existing.lifecycle,
              to,
              at: now.toISOString(),
              actor: { type: "SYSTEM" },
              reason:
                to === "RESOLVED"
                  ? "BACKLINKS: verified resolution"
                  : "BACKLINKS: issue observed again",
            },
          ] as Prisma.InputJsonValue,
        },
      });
      if (changed.count)
        await tx.fixImpactLedgerEvent.create({
          data: {
            projectId,
            eventType:
              to === "RESOLVED"
                ? "BACKLINK_ACTION_VERIFIED"
                : "BACKLINK_ACTION_REOPENED",
            title: existing.title,
            description:
              to === "RESOLVED"
                ? "Fresh backlink or destination evidence confirmed this action is no longer required. This records verification, not a claim of ranking or revenue impact."
                : "Fresh evidence shows this backlink action needs attention again.",
            actor: "SYSTEM",
            affectedUrl: existing.affectedPages[0],
            verificationStatus:
              to === "RESOLVED" ? "VERIFIED" : "NEEDS_ATTENTION",
            evidenceData: {
              source: "BACKLINKS",
              findingId: existing.id,
              sourceId: existing.detailRef,
              fingerprint,
              evidence: existing.evidence,
            },
          },
        });
    });
  }

  /** Bounded reconciliation also runs after audits, so destination fixes unlock tasks. */
  async reconcile(projectId: string) {
    const sources = await this.prisma.backlinkSource.findMany({
      where: {
        projectId,
        lastAttemptAt: { gte: new Date(Date.now() - 7 * DAY) },
      },
      take: 100,
      orderBy: { lastAttemptAt: "desc" },
      select: { id: true },
    });
    for (const source of sources)
      await this.syncSourceActions(projectId, source.id);
    return { reconciled: sources.length, limit: 100 };
  }

  async report(projectId: string, offset = 0) {
    const context = await this.context(projectId);
    const recent = new Date(Date.now() - 7 * DAY);
    const where = { source: { projectId } };
    const [
      sources,
      totalSources,
      verified,
      lost,
      groups,
      opportunities,
      referringSources,
      openActions,
    ] = await Promise.all([
      this.prisma.backlinkSource.findMany({
        where: { projectId },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: offset,
        take: 25,
        include: {
          links: { take: 100, orderBy: { targetUrl: "asc" } },
          observations: {
            take: 1,
            orderBy: { checkedAt: "desc" },
            select: { id: true, reason: true },
          },
          _count: { select: { links: true } },
        },
      }),
      this.prisma.backlinkSource.count({ where: { projectId } }),
      this.prisma.backlink.count({
        where: {
          ...where,
          targetKind: "OWN",
          status: "VERIFIED",
          lastVerifiedAt: { gte: recent },
        },
      }),
      this.prisma.backlink.count({
        where: { ...where, targetKind: "OWN", status: "LOST" },
      }),
      this.prisma.backlink.findMany({
        where: {
          ...where,
          status: "VERIFIED",
          lastVerifiedAt: { gte: recent },
        },
        take: 10000,
        select: {
          targetKind: true,
          targetUrl: true,
          source: { select: { id: true, sourceUrl: true } },
        },
      }),
      this.prisma.growthOpportunity.findMany({
        where: {
          projectId,
          source: "BACKLINKS",
          status: "OPEN",
          lifecycle: { notIn: ["RESOLVED", "DISMISSED", "SNOOZED"] },
        },
        orderBy: { priority: "desc" },
        take: 50,
      }),
      this.prisma.backlinkSource.findMany({
        where: {
          projectId,
          links: {
            some: {
              targetKind: "OWN",
              status: "VERIFIED",
              lastVerifiedAt: { gte: recent },
            },
          },
        },
        select: { sourceUrl: true },
      }),
      this.prisma.growthOpportunity.count({
        where: {
          projectId,
          source: "BACKLINKS",
          status: "OPEN",
          lifecycle: { notIn: ["RESOLVED", "DISMISSED", "SNOOZED"] },
        },
      }),
    ]);
    const ready = await this.readiness(
      projectId,
      sources.flatMap((source) =>
        source.links
          .filter((link) => link.targetKind === "OWN")
          .map((link) => link.targetUrl),
      ),
    );
    const ownDomains = new Set(
      referringSources.map((source) => hostOf(source.sourceUrl)),
    );
    const prospects = groups
      .filter(
        (link) =>
          link.targetKind === "COMPETITOR" &&
          !ownDomains.has(hostOf(link.source.sourceUrl)),
      )
      .slice(0, 50);
    return {
      coverage:
        "Observed source pages only. Imports and project crawls are not a complete web backlink index. Static HTML verification does not execute JavaScript.",
      ownDomains: context.own,
      competitorDomains: context.competitors,
      summary: {
        totalSources,
        verifiedLinks: verified,
        referringDomains: ownDomains.size,
        confirmedLostLinks: lost,
        openActions,
      },
      offset,
      pageSize: 25,
      limits: {
        sources: MAX_SOURCES,
        importRows: 200,
        linksPerSourceShown: 100,
        graphRows: 10000,
        graphTruncated: groups.length === 10000,
      },
      sources: sources.map((source) => ({
        ...source,
        links: source.links.map((link) => ({
          ...link,
          fresh: !!link.lastVerifiedAt && link.lastVerifiedAt >= recent,
          readiness:
            link.targetKind === "OWN" ? ready.get(link.targetUrl) : null,
        })),
      })),
      prospects,
      opportunities,
    };
  }

  async history(projectId: string, sourceId: string, offset = 0) {
    const source = await this.prisma.backlinkSource.findFirst({
      where: { id: sourceId, projectId },
      select: { id: true, sourceUrl: true },
    });
    if (!source) throw new NotFoundException("Source page not found.");
    return {
      ...source,
      offset,
      observations: await this.prisma.backlinkObservation.findMany({
        where: { sourceId },
        orderBy: { checkedAt: "desc" },
        skip: offset,
        take: 25,
      }),
    };
  }

  async remove(projectId: string, sourceId: string) {
    await this.history(projectId, sourceId);
    await this.prisma.$transaction([
      this.prisma.growthOpportunity.deleteMany({
        where: { projectId, source: "BACKLINKS", detailRef: sourceId },
      }),
      this.prisma.backlinkSource.deleteMany({
        where: { id: sourceId, projectId },
      }),
    ]);
    return { removed: true };
  }
}
