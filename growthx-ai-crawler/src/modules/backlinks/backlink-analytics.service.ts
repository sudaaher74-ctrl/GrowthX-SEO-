import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { BacklinksService } from "./backlinks.service";
import { belongsTo, DAY } from "./backlink-evidence";
import { csvDocument, referringDomain } from "./backlink-analytics.helpers";
import { ExploreBacklinksDto } from "./backlinks.dto";

type Aggregate = {
  links: number;
  referringDomains: number;
  firstObservedAt: Date | null;
  lastVerifiedAt: Date | null;
};
type ProfileCounts = {
  tracked: number;
  observed: number;
  verified: number;
  referringDomains: number;
  confirmedLost: number;
  newlyObserved: number;
  followed: number;
  qualified: number;
  mixed: number;
  unclassified: number;
};

@Injectable()
export class BacklinkAnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly backlinks: BacklinksService,
  ) {}

  private predicate(
    projectId: string,
    query: ExploreBacklinksDto,
  ): Prisma.BacklinkWhereInput {
    const fresh = new Date(Date.now() - 7 * DAY);
    return {
      source: { projectId },
      targetKind:
        query.targetKind === "ALL" ? undefined : (query.targetKind ?? "OWN"),
      status: query.status && query.status !== "ALL" ? query.status : undefined,
      followState:
        query.followState && query.followState !== "ALL"
          ? query.followState
          : undefined,
      ...(query.linkType && query.linkType !== "ALL"
        ? { linkTypes: { has: query.linkType } }
        : {}),
      ...(query.placement && query.placement !== "ALL"
        ? { placements: { has: query.placement } }
        : {}),
      ...(query.freshness === "FRESH"
        ? { AND: [{ lastVerifiedAt: { gte: fresh } }, { status: "VERIFIED" }] }
        : query.freshness === "STALE"
          ? { lastVerifiedAt: { lt: fresh } }
          : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              {
                targetUrl: {
                  contains: query.search.trim(),
                  mode: "insensitive",
                },
              },
              {
                anchorText: {
                  contains: query.search.trim(),
                  mode: "insensitive",
                },
              },
              {
                source: {
                  projectId,
                  sourceUrl: {
                    contains: query.search.trim(),
                    mode: "insensitive",
                  },
                },
              },
            ],
          }
        : {}),
    };
  }

  private ordering(sort?: string): Prisma.BacklinkOrderByWithRelationInput[] {
    return [
      sort === "oldest"
        ? { firstObservedAt: { sort: "asc", nulls: "last" } }
        : sort === "changed"
          ? { lastChangedAt: { sort: "desc", nulls: "last" } }
          : sort === "verified"
            ? { lastVerifiedAt: { sort: "desc", nulls: "last" } }
            : { firstObservedAt: { sort: "desc", nulls: "last" } },
      { id: "asc" },
    ];
  }

  async explore(projectId: string, query: ExploreBacklinksDto) {
    const where = this.predicate(projectId, query);
    const [links, total] = await Promise.all([
      this.prisma.backlink.findMany({
        where,
        orderBy: this.ordering(query.sort),
        skip: query.offset ?? 0,
        take: 50,
        include: {
          source: {
            select: {
              id: true,
              sourceUrl: true,
              discovery: true,
              lastAttemptAt: true,
            },
          },
        },
      }),
      this.prisma.backlink.count({ where }),
    ]);
    const readiness = await this.backlinks.readiness(
      projectId,
      links
        .filter((link) => link.targetKind === "OWN")
        .map((link) => link.targetUrl),
    );
    return {
      total,
      offset: query.offset ?? 0,
      pageSize: 50,
      links: links.map((link) => ({
        ...link,
        referringDomain: referringDomain(link.source.sourceUrl),
        fresh:
          link.status === "VERIFIED" &&
          !!link.lastVerifiedAt &&
          Date.now() - link.lastVerifiedAt.getTime() <= 7 * DAY,
        readiness:
          link.targetKind === "OWN" ? readiness.get(link.targetUrl) : null,
      })),
    };
  }

  async export(projectId: string, query: ExploreBacklinksDto) {
    const where = this.predicate(projectId, query);
    const [rows, total] = await Promise.all([
      this.prisma.backlink.findMany({
        where,
        orderBy: this.ordering(query.sort),
        take: 10000,
        include: { source: { select: { sourceUrl: true, discovery: true } } },
      }),
      this.prisma.backlink.count({ where }),
    ]);
    return {
      filename: "growthx-observed-backlinks.csv",
      total,
      exported: rows.length,
      truncated: rows.length < total,
      coverage:
        "Observed project data only. Export is capped at 10,000 matching source/destination pairs. Unverified candidates are not backlinks.",
      csv: csvDocument([
        [
          "Source URL",
          "Referring domain",
          "Target URL",
          "Target kind",
          "Status",
          "Anchor",
          "Follow state",
          "Rel observed",
          "Link types",
          "Placements",
          "First observed (UTC)",
          "Last verified (UTC)",
          "Confirmed loss (UTC)",
          "Discovery",
        ],
        ...rows.map((link) => [
          link.source.sourceUrl,
          referringDomain(link.source.sourceUrl),
          link.targetUrl,
          link.targetKind,
          link.status,
          link.anchorText,
          link.followState,
          link.rel.join(" "),
          link.linkTypes.join(" "),
          link.placements.join(" "),
          link.firstObservedAt?.toISOString(),
          link.lastVerifiedAt?.toISOString(),
          link.lostConfirmedAt?.toISOString(),
          link.source.discovery,
        ]),
      ]),
    };
  }

  async changes(projectId: string, offset = 0) {
    const where = { backlink: { source: { projectId } } };
    const [events, total] = await Promise.all([
      this.prisma.backlinkChange.findMany({
        where,
        skip: offset,
        take: 50,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        include: {
          backlink: {
            select: {
              targetUrl: true,
              targetKind: true,
              source: { select: { sourceUrl: true } },
            },
          },
        },
      }),
      this.prisma.backlinkChange.count({ where }),
    ]);
    return { events, total, offset, pageSize: 50 };
  }

  async profile(projectId: string, days = 30) {
    const context = await this.backlinks.context(projectId);
    const now = new Date();
    const fresh = new Date(now.getTime() - 7 * DAY);
    const since = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
        (days - 1) * DAY,
    );
    const sources = await this.prisma.backlinkSource.findMany({
      where: { projectId },
      select: { id: true, sourceUrl: true, changeHistoryTruncated: true },
    });
    const domainById = Object.fromEntries(
      sources.map((source) => [source.id, referringDomain(source.sourceUrl)]),
    );
    const origins = Prisma.sql`WITH origins AS (SELECT key AS id, value AS domain FROM jsonb_each_text(${JSON.stringify(domainById)}::jsonb))`;
    const from = Prisma.sql`FROM "Backlink" b JOIN "BacklinkSource" s ON s.id=b."sourceId" JOIN origins o ON o.id=s.id WHERE s."projectId"=${projectId}`;
    const live = Prisma.sql`b."targetKind"='OWN' AND b.status='VERIFIED' AND b."lastVerifiedAt">=${fresh}`;
    const [counts, anchorRows, pageRows, domainRows, matrix, trendRows] =
      await Promise.all([
        this.prisma.$queryRaw<ProfileCounts[]>(Prisma.sql`${origins} SELECT
        count(*) FILTER (WHERE b."targetKind"='OWN')::int AS tracked,
        count(*) FILTER (WHERE b."targetKind"='OWN' AND b."firstObservedAt" IS NOT NULL)::int AS observed,
        count(*) FILTER (WHERE ${live})::int AS verified,
        count(DISTINCT o.domain) FILTER (WHERE ${live})::int AS "referringDomains",
        count(*) FILTER (WHERE b."targetKind"='OWN' AND b."lostConfirmedAt" IS NOT NULL)::int AS "confirmedLost",
        count(*) FILTER (WHERE b."targetKind"='OWN' AND b."firstObservedAt">=${since})::int AS "newlyObserved",
        count(*) FILTER (WHERE ${live} AND b."followState"='FOLLOWED')::int AS followed,
        count(*) FILTER (WHERE ${live} AND b."followState"='QUALIFIED')::int AS qualified,
        count(*) FILTER (WHERE ${live} AND b."followState"='MIXED')::int AS mixed,
        count(*) FILTER (WHERE ${live} AND b."followState"='UNKNOWN')::int AS unclassified ${from}`),
        this.prisma.$queryRaw<
          (Aggregate & { anchor: string })[]
        >(Prisma.sql`${origins} SELECT COALESCE(b."anchorText",'') AS anchor,
        count(*)::int AS links, count(DISTINCT o.domain)::int AS "referringDomains", min(b."firstObservedAt") AS "firstObservedAt", max(b."lastVerifiedAt") AS "lastVerifiedAt"
        ${from} AND ${live} GROUP BY COALESCE(b."anchorText",'') ORDER BY links DESC, anchor ASC LIMIT 100`),
        this.prisma.$queryRaw<
          (Aggregate & { targetUrl: string; followed: number })[]
        >(Prisma.sql`${origins} SELECT b."targetUrl", count(*)::int AS links,
        count(DISTINCT o.domain)::int AS "referringDomains", min(b."firstObservedAt") AS "firstObservedAt", max(b."lastVerifiedAt") AS "lastVerifiedAt",
        count(*) FILTER (WHERE b."followState" IN ('FOLLOWED','MIXED'))::int AS followed
        ${from} AND ${live} GROUP BY b."targetUrl" ORDER BY "referringDomains" DESC, links DESC, b."targetUrl" ASC LIMIT 100`),
        this.prisma.$queryRaw<
          (Aggregate & {
            domain: string;
            sourcePages: number;
            followed: number;
          })[]
        >(Prisma.sql`${origins} SELECT o.domain, count(*)::int AS links,
        count(DISTINCT s.id)::int AS "sourcePages", min(b."firstObservedAt") AS "firstObservedAt", max(b."lastVerifiedAt") AS "lastVerifiedAt",
        count(*) FILTER (WHERE b."followState" IN ('FOLLOWED','MIXED'))::int AS followed
        ${from} AND ${live} GROUP BY o.domain ORDER BY links DESC, o.domain ASC LIMIT 100`),
        this.prisma.backlink.groupBy({
          take: 50001,
          orderBy: [
            { sourceId: "asc" },
            { targetHost: "asc" },
            { targetKind: "asc" },
          ],
          by: ["sourceId", "targetHost", "targetKind"],
          where: {
            source: { projectId },
            status: "VERIFIED",
            lastVerifiedAt: { gte: fresh },
          },
          _count: { _all: true },
        }),
        this.prisma.$queryRaw<
          { date: string; kind: string; count: number }[]
        >(Prisma.sql`SELECT to_char(b."firstObservedAt",'YYYY-MM-DD') AS date, 'FOUND' AS kind, count(*)::int AS count
        FROM "Backlink" b JOIN "BacklinkSource" s ON s.id=b."sourceId" WHERE s."projectId"=${projectId} AND b."targetKind"='OWN' AND b."firstObservedAt">=${since}
        GROUP BY date UNION ALL SELECT to_char(e."occurredAt",'YYYY-MM-DD') AS date, e.kind, count(*)::int AS count
        FROM "BacklinkChange" e JOIN "Backlink" b ON b.id=e."backlinkId" JOIN "BacklinkSource" s ON s.id=b."sourceId"
        WHERE s."projectId"=${projectId} AND b."targetKind"='OWN' AND e."occurredAt">=${since} AND e.kind<>'FOUND' GROUP BY date,e.kind`),
      ]);
    const readiness = await this.backlinks.readiness(
      projectId,
      pageRows.map((row) => row.targetUrl),
    );
    const intersectionLimited = matrix.length > 50000;
    const intersection = new Map<
      string,
      { domain: string; ownLinks: number; competitors: Record<string, number> }
    >();
    for (const row of matrix) {
      const domain = domainById[row.sourceId];
      if (!domain) continue;
      const item = intersection.get(domain) ?? {
        domain,
        ownLinks: 0,
        competitors: {},
      };
      if (row.targetKind === "OWN") item.ownLinks += row._count._all;
      else {
        const competitor = context.competitors.find((root) =>
          belongsTo(row.targetHost, [root]),
        );
        if (competitor)
          item.competitors[competitor] =
            (item.competitors[competitor] ?? 0) + row._count._all;
      }
      intersection.set(domain, item);
    }
    const timeline = Array.from({ length: days }, (_, i) => ({
      date: new Date(since.getTime() + i * DAY).toISOString().slice(0, 10),
      found: 0,
      lost: 0,
      recovered: 0,
      changed: 0,
    }));
    for (const row of trendRows) {
      const day = timeline.find((item) => item.date === row.date);
      if (!day) continue;
      if (row.kind === "FOUND") day.found += row.count;
      if (row.kind === "LOST") day.lost += row.count;
      if (row.kind === "RECOVERED") day.recovered += row.count;
      if (row.kind === "ATTRIBUTES_CHANGED") day.changed += row.count;
    }
    return {
      days,
      since,
      measuredAt: now,
      coverage:
        "Your observed backlink dataset, not the entire web. Profile tables use own-site links verified within seven days. Counts represent source/destination pairs; anchor and link attributes summarize observed occurrences.",
      historyLimited: sources.some((source) => source.changeHistoryTruncated),
      authority: {
        available: false,
        reason:
          "A web-wide authority graph is not available. No DR, DA, traffic estimate or toxicity score is invented.",
      },
      counts: counts[0],
      anchors: anchorRows.map((row) => ({
        ...row,
        share: counts[0].verified ? row.links / counts[0].verified : 0,
      })),
      topPages: pageRows.map((row) => ({
        ...row,
        readiness: readiness.get(row.targetUrl),
      })),
      referringDomains: domainRows,
      competitors: context.competitors,
      intersectionLimited,
      intersection: (intersectionLimited ? [] : [...intersection.values()])
        .map((row) => ({
          ...row,
          competitorsCount: Object.keys(row.competitors).length,
        }))
        .filter((row) => row.competitorsCount > 0)
        .sort(
          (a, b) =>
            b.competitorsCount - a.competitorsCount ||
            a.domain.localeCompare(b.domain),
        ),
      timeline,
      limits: {
        tableRows: 100,
        exportRows: 10000,
        eventRetentionDays: 365,
        eventsPerSource: 5000,
      },
    };
  }
}
