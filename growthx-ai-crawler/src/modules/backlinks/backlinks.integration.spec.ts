import { Module, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PassportModule } from "@nestjs/passport";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { createServer, Server } from "http";
import { randomUUID } from "crypto";
import IORedis from "ioredis";
import { PrismaService } from "../../database/prisma.service";
import { JwtStrategy } from "../auth/jwt.strategy";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UsersService } from "../users/users.service";
import { QueueService } from "../queue/queue.service";
import { BacklinkFetcher } from "./backlink-fetcher.service";
import { BacklinkQueue } from "./backlink-queue.service";
import { BacklinksController } from "./backlinks.controller";
import { BacklinksService } from "./backlinks.service";
import { DAY } from "./backlink-evidence";

// Explicit opt-in, restricted to a local disposable database and Redis instance.
const enabled = process.env.BACKLINKS_INTEGRATION === "true";
const integration = enabled ? describe : describe.skip;

integration(
  "backlink workflow — real HTTP, PostgreSQL, Redis and BullMQ",
  () => {
    let db: PrismaService,
      redis: IORedis,
      app: Awaited<ReturnType<typeof NestFactory.create>>;
    let fixture: Server,
      base: string,
      origin: string,
      projectId: string,
      otherProjectId: string;
    let sourceId: string,
      prospectId: string,
      orgId: string,
      userId: string,
      viewerId: string,
      pageId: string;
    let token: string, viewerToken: string;
    let sourceMode: "present" | "missing" | "blocked" = "present",
      prospectEarned = false;
    const ownHost = `client-${randomUUID()}.example`;
    const own = `https://${ownHost}/service`;
    const secret = "backlinks-integration-test-secret-only-32-characters";

    const html = (links: string) =>
      `<html><head><title>Publisher resource</title></head><body><p>Independent resource page with editorial links.</p>${links}</body></html>`;
    const ownLink = `<a href="${own}" rel="sponsored nofollow">Client service</a>`;
    const competitorLink =
      '<a href="https://rival.example/product">Competitor product</a>';

    async function request(
      path = "",
      method = "GET",
      body?: unknown,
      access = token,
    ) {
      const response = await fetch(
        `${base}/api/projects/${projectId}/backlinks${path}`,
        {
          method,
          headers: {
            ...(access ? { authorization: `Bearer ${access}` } : {}),
            "content-type": "application/json",
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
      );
      return { status: response.status, body: (await response.json()) as any };
    }

    async function check(id: string) {
      await db.backlinkSource.update({
        where: { id },
        data: { lastAttemptAt: new Date(Date.now() - 11 * 60_000) },
      });
      const previous = await db.backlinkObservation.count({
        where: { sourceId: id },
      });
      expect((await request("/verify", "POST", { sourceId: id })).status).toBe(
        201,
      );
      const deadline = Date.now() + 20_000;
      while (Date.now() < deadline) {
        if (
          (await db.backlinkObservation.count({ where: { sourceId: id } })) >
          previous
        ) {
          // A queue job also reconciles tasks after writing the observation.
          const queue = app.get(BacklinkQueue);
          if ((await queue.status()).active === 0) return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("Verification did not finish within its test deadline.");
    }

    beforeAll(async () => {
      const database = new URL(process.env.DATABASE_URL ?? "http://missing");
      if (
        database.hostname !== "127.0.0.1" ||
        !database.pathname.endsWith("_test") ||
        process.env.REDIS_URL !== "redis://127.0.0.1:56389"
      ) {
        throw new Error(
          "Run only against the documented disposable local database and Redis.",
        );
      }
      process.env.JWT_SECRET = secret;
      process.env.AUTH_DEV_BYPASS = "false";
      db = new PrismaService();
      await db.$connect();
      redis = new IORedis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null,
      });
      const tag = randomUUID();
      const org = await db.organization.create({
        data: {
          name: "Backlinks integration test",
          slug: `backlinks-test-${tag}`,
        },
      });
      orgId = org.id;
      const user = await db.user.create({
        data: {
          email: `backlinks-${tag}@example.test`,
          passwordHash: "unused-test-hash",
        },
      });
      userId = user.id;
      const viewer = await db.user.create({
        data: {
          email: `viewer-${tag}@example.test`,
          passwordHash: "unused-test-hash",
        },
      });
      viewerId = viewer.id;
      await db.organizationMember.createMany({
        data: [
          { organizationId: orgId, userId, role: "OWNER" },
          { organizationId: orgId, userId: viewerId, role: "VIEWER" },
        ],
      });
      const project = await db.project.create({
        data: { name: "Backlink test project", organizationId: orgId },
      });
      projectId = project.id;
      const otherOrg = await db.organization.create({
        data: {
          id: `other-${orgId}`,
          name: "Other tenant",
          slug: `other-${tag}`,
        },
      });
      otherProjectId = (
        await db.project.create({
          data: { name: "Other tenant project", organizationId: otherOrg.id },
        })
      ).id;
      const website = await db.website.create({
        data: {
          projectId,
          domain: ownHost,
          url: `https://${ownHost}/`,
          scope: "own",
        },
      });
      await db.competitorDomain.create({
        data: { projectId, domain: "rival.example" },
      });
      const job = await db.crawlJob.create({
        data: {
          websiteId: website.id,
          status: "COMPLETED",
          finishedAt: new Date(),
        },
      });
      pageId = (
        await db.page.create({
          data: {
            crawlJobId: job.id,
            url: own,
            finalUrl: own,
            statusCode: 404,
            responseTimeMs: 1,
            indexability: "NOT_INDEXABLE",
          },
        })
      ).id;
      fixture = createServer((req, res) => {
        if (req.url === "/robots.txt") {
          res.writeHead(404).end();
          return;
        }
        if (req.url === "/source" && sourceMode === "blocked") {
          res.writeHead(403).end("Denied");
          return;
        }
        res.writeHead(200, { "content-type": "text/html" });
        res.end(
          html(
            req.url === "/prospect"
              ? competitorLink + (prospectEarned ? ownLink : "")
              : competitorLink + (sourceMode === "present" ? ownLink : ""),
          ),
        );
      });
      await new Promise<void>((resolve) =>
        fixture.listen(0, "127.0.0.1", resolve),
      );
      origin = `http://127.0.0.1:${(fixture.address() as { port: number }).port}`;

      @Module({
        imports: [PassportModule.register({ defaultStrategy: "jwt" })],
        controllers: [BacklinksController],
        providers: [
          { provide: PrismaService, useValue: db },
          {
            provide: QueueService,
            useValue: { ready: Promise.resolve(), getRedisClient: () => redis },
          },
          {
            provide: JwtStrategy,
            useFactory: () =>
              new JwtStrategy(
                {} as ConfigService,
                {
                  findById: (id: string) =>
                    db.user.findUnique({ where: { id } }),
                } as unknown as UsersService,
                db,
              ),
          },
          JwtAuthGuard,
          BacklinksService,
          BacklinkFetcher,
          BacklinkQueue,
        ],
      })
      class IntegrationModule {}
      app = await NestFactory.create(IntegrationModule, { logger: false });
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.listen(0, "127.0.0.1");
      base = await app.getUrl();
      const jwt = new JwtService({ secret });
      token = jwt.sign(
        { sub: userId, email: user.email, organizationId: orgId },
        { expiresIn: "10m" },
      );
      viewerToken = jwt.sign(
        { sub: viewerId, email: viewer.email, organizationId: orgId },
        { expiresIn: "10m" },
      );
    }, 30_000);

    afterAll(async () => {
      await app?.close();
      await new Promise<void>((resolve) =>
        fixture ? fixture.close(() => resolve()) : resolve(),
      );
      if (db && orgId)
        await db.organization.deleteMany({
          where: { id: { in: [orgId, `other-${orgId}`] } },
        });
      if (db && userId)
        await db.user.deleteMany({ where: { id: { in: [userId, viewerId] } } });
      await redis?.quit();
      await db?.$disconnect();
    });

    it("enforces authentication, project membership, viewer restrictions and input validation", async () => {
      expect((await request("", "GET", undefined, "")).status).toBe(401);
      expect(
        (
          await request(
            "/import",
            "POST",
            { text: `${origin}/source` },
            viewerToken,
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request("/import", "POST", {
            text: `https://${ownHost}/internal`,
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await request("/import", "POST", {
            text: "sourceUrl,targetUrl\nhttps://publisher.example/,https://untracked.example/",
          })
        ).status,
      ).toBe(400);
      expect((await request("?offset=-1")).status).toBe(400);
      const other = await fetch(
        `${base}/api/projects/${otherProjectId}/backlinks`,
        { headers: { authorization: `Bearer ${token}` } },
      );
      expect(other.status).toBe(404);
    });

    it("saves source-only candidates idempotently without inventing backlinks", async () => {
      const result = await request("/import", "POST", {
        text: `${origin}/source\n${origin}/prospect`,
        discovery: "GSC_CSV",
      });
      expect(result.body.added).toBe(2);
      expect(
        (await request("/import", "POST", { text: `${origin}/source` })).body
          .added,
      ).toBe(0);
      const report = (await request()).body;
      expect(report.summary.verifiedLinks).toBe(0);
      expect(
        report.sources.every((source: any) => source.links.length === 0),
      ).toBe(true);
      sourceId = report.sources.find((source: any) =>
        source.sourceUrl.endsWith("/source"),
      ).id;
      prospectId = report.sources.find((source: any) =>
        source.sourceUrl.endsWith("/prospect"),
      ).id;
      const otherSource = await db.backlinkSource.create({
        data: {
          projectId: otherProjectId,
          sourceUrl: `${origin}/other`,
          origin,
          discovery: "MANUAL",
        },
      });
      expect((await request(`/sources/${otherSource.id}/history`)).status).toBe(
        404,
      );
      expect(
        (await request(`/sources/${otherSource.id}`, "DELETE")).status,
      ).toBe(404);
    });

    it("verifies through BullMQ and creates a destination repair action from real crawl evidence", async () => {
      await check(sourceId);
      const report = (await request()).body;
      expect(report.summary.verifiedLinks).toBe(1);
      const link = report.sources
        .find((source: any) => source.id === sourceId)
        .links.find((item: any) => item.targetKind === "OWN");
      expect(link).toMatchObject({
        status: "VERIFIED",
        anchorText: "Client service",
        readiness: { state: "NEEDS_FIX" },
      });
      expect(link.firstObservedAt).toBeTruthy();
      expect(
        report.opportunities.some((item: any) =>
          item.title.includes("Repair a destination"),
        ),
      ).toBe(true);
      const count = await db.backlinkObservation.count({ where: { sourceId } });
      await request("/verify", "POST", { sourceId });
      expect(await db.backlinkObservation.count({ where: { sourceId } })).toBe(
        count,
      );
    }, 25_000);

    it("gates a reviewed competitor-source plan on destination readiness, then verifies completion", async () => {
      await check(prospectId);
      expect(
        (
          await request("/plan", "POST", {
            sourceId: prospectId,
            targetUrl: own,
            relevanceReviewed: false,
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await request("/plan", "POST", {
            sourceId: prospectId,
            targetUrl: own,
            relevanceReviewed: true,
          })
        ).body.message,
      ).toContain("prerequisite");
      await db.page.update({
        where: { id: pageId },
        data: {
          statusCode: 200,
          indexability: "INDEXABLE",
          crawledAt: new Date(),
        },
      });
      await request("/reconcile", "POST", {});
      let actions = await db.growthOpportunity.findMany({
        where: { projectId, source: "BACKLINKS" },
      });
      expect(
        actions.find((action) =>
          action.fingerprint.startsWith("backlinks:repair:"),
        )?.lifecycle,
      ).toBe("RESOLVED");
      expect(
        actions.find((action) =>
          action.fingerprint.startsWith("backlinks:earn:"),
        )?.title,
      ).toContain("Review a relevant publisher");
      prospectEarned = true;
      await check(prospectId);
      actions = await db.growthOpportunity.findMany({
        where: { projectId, source: "BACKLINKS" },
      });
      expect(
        actions.find((action) =>
          action.fingerprint.startsWith("backlinks:earn:"),
        )?.lifecycle,
      ).toBe("RESOLVED");
      const verifiedEvents = await db.fixImpactLedgerEvent.count({
        where: { projectId, eventType: "BACKLINK_ACTION_VERIFIED" },
      });
      expect(verifiedEvents).toBe(2);
      await request("/reconcile", "POST", {});
      expect(
        await db.fixImpactLedgerEvent.count({
          where: { projectId, eventType: "BACKLINK_ACTION_VERIFIED" },
        }),
      ).toBe(verifiedEvents);
    }, 30_000);

    it("confirms loss through separated observations, keeps blocks unknown, and verifies recovery", async () => {
      sourceMode = "missing";
      await check(sourceId);
      let link = await db.backlink.findFirstOrThrow({
        where: { sourceId, targetKind: "OWN" },
      });
      expect(link.status).toBe("MISSING");
      await db.backlink.update({
        where: { id: link.id },
        data: { firstMissingAt: new Date(Date.now() - DAY - 1000) },
      });
      await check(sourceId);
      link = await db.backlink.findUniqueOrThrow({ where: { id: link.id } });
      expect(link.status).toBe("LOST");
      const action = await db.growthOpportunity.findFirstOrThrow({
        where: { projectId, fingerprint: `backlinks:recover:${link.id}` },
      });
      expect(action.lifecycle).toBe("QUEUED");
      sourceMode = "blocked";
      await check(sourceId);
      link = await db.backlink.findUniqueOrThrow({ where: { id: link.id } });
      expect(link.status).toBe("BLOCKED");
      expect(link.lastVerifiedAt).not.toBeNull();
      expect(
        (
          await db.growthOpportunity.findUniqueOrThrow({
            where: { id: action.id },
          })
        ).lifecycle,
      ).toBe("QUEUED");
      sourceMode = "present";
      await check(sourceId);
      expect(
        (
          await db.growthOpportunity.findUniqueOrThrow({
            where: { id: action.id },
          })
        ).lifecycle,
      ).toBe("RESOLVED");
      const history = (await request(`/sources/${sourceId}/history`)).body;
      expect(history.observations.length).toBeGreaterThanOrEqual(5);
      expect(history.observations[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
    }, 60_000);

    it("keeps stale audit readiness unknown and preserves user dismissal on redetection", async () => {
      await db.page.update({
        where: { id: pageId },
        data: { crawledAt: new Date(Date.now() - 8 * DAY) },
      });
      expect(
        (await app.get(BacklinksService).readiness(projectId, [own])).get(own)
          ?.state,
      ).toBe("UNKNOWN");
      await db.page.update({
        where: { id: pageId },
        data: {
          crawledAt: new Date(),
          statusCode: 404,
          indexability: "NOT_INDEXABLE",
        },
      });
      await request("/reconcile", "POST", {});
      const action = await db.growthOpportunity.findFirstOrThrow({
        where: { projectId, fingerprint: { startsWith: "backlinks:repair:" } },
      });
      await db.growthOpportunity.update({
        where: { id: action.id },
        data: {
          lifecycle: "DISMISSED",
          status: "DISMISSED",
          dismissReason: "User reviewed",
        },
      });
      await request("/reconcile", "POST", {});
      expect(
        (
          await db.growthOpportunity.findUniqueOrThrow({
            where: { id: action.id },
          })
        ).lifecycle,
      ).toBe("DISMISSED");
    });

    it("removes only the selected project source and cascades its history and tasks", async () => {
      expect((await request(`/sources/${sourceId}`, "DELETE")).status).toBe(
        200,
      );
      expect(await db.backlinkObservation.count({ where: { sourceId } })).toBe(
        0,
      );
      expect(
        await db.growthOpportunity.count({
          where: { projectId, source: "BACKLINKS", detailRef: sourceId },
        }),
      ).toBe(0);
      expect(await db.backlinkSource.count({ where: { id: prospectId } })).toBe(
        1,
      );
    });
  },
);
