import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import type IORedis from 'ioredis';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { jwtSecret } from '../../config/secrets';
import { allowedBrowserOrigins } from '../../config/allowed-origins';

export const REALTIME_PUBSUB_CHANNEL = 'growthx:realtime:events';

/** Fallback upper bound when a valid token omits an `exp` claim (15 minutes). */
const MAX_SOCKET_SESSION_MS = 15 * 60 * 1000;

export interface FindingsUpdatedPayload {
  sources: string[];
  created: number;
  updated: number;
  resolved: number;
  savedPlansResolved?: number;
  regressionsDetected?: number;
  updatedAt: string;
}

type RealtimeBroadcastMessage =
  | { kind: 'crawl.progress'; jobId: string; payload: unknown }
  | { kind: 'crawl.completed'; jobId: string; payload: unknown }
  | { kind: 'findings.updated'; projectId: string; payload: FindingsUpdatedPayload }
  | { kind: 'aiva.progress'; sessionId: string; payload: { tool: string; status: string; message: string; data?: unknown } }
  | { kind: 'access.revoked'; userId: string; organizationId?: string };

function normalizeOrigin(origin: string | undefined): string | null {
  if (!origin || typeof origin !== 'string') return null;
  const trimmed = origin.trim().replace(/\/+$/, '');
  return trimmed || null;
}

function isOriginAllowed(origin: string | undefined, hostHeader: string | undefined, usesCookieAuth: boolean): boolean {
  const normalized = normalizeOrigin(origin);
  const allowed = allowedBrowserOrigins();

  if (!normalized) {
    // Browser WebSocket upgrades always send an Origin header. Never allow a
    // cookie-authenticated WebSocket handshake without a verified Origin.
    // Non-browser clients presenting an explicit bearer token in handshake.auth
    // (without relying on cookies) are permitted without an Origin header.
    return !usesCookieAuth;
  }

  if (allowed.includes(normalized)) {
    return true;
  }

  // Exact same-origin fallback (e.g., production reverse proxy serving UI & API on same host).
  if (hostHeader) {
    try {
      const parsed = new URL(normalized);
      const reqHost = hostHeader.split(',')[0].trim().toLowerCase();
      if (reqHost && parsed.host.toLowerCase() === reqHost) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}

interface ExtractedHandshakeToken {
  token: string | null;
  viaCookie: boolean;
}

/** Pulls the access token from the handshake: explicit auth payload first, then the HttpOnly cookie. */
function tokenFromHandshake(client: Socket): ExtractedHandshakeToken {
  const fromAuth = (client.handshake.auth as { token?: unknown } | undefined)?.token;
  if (typeof fromAuth === 'string' && fromAuth) {
    return { token: fromAuth, viaCookie: false };
  }
  const header = client.handshake.headers?.cookie;
  if (header) {
    const match = /(?:^|;\s*)access_token=([^;]+)/.exec(header);
    if (match) {
      try {
        return { token: decodeURIComponent(match[1]), viaCookie: true };
      } catch {
        return { token: null, viaCookie: true };
      }
    }
  }
  return { token: null, viaCookie: false };
}

const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Real-time progress channel.
 *
 * Security boundaries enforced here:
 * 1. Explicit handshake `Origin` validation against `allowedBrowserOrigins()`
 *    (CORS does not gate raw WebSocket upgrades, and production cookies use SameSite=None).
 * 2. Valid access JWT verification + `sessionsInvalidatedAt` check.
 * 3. Exact expiry timer that disconnects the socket the moment its JWT expires.
 * 4. Per-organization room tracking + immediate eviction via `revokeOrganizationAccess`
 *    (propagated over Redis Pub/Sub across replicas) and broadcast-time expiry pruning.
 */
@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowed = allowedBrowserOrigins();
      const normalized = normalizeOrigin(origin);
      if (!normalized) {
        // Non-browser HTTP polling without Origin is only permitted in non-production
        // or when explicit bearer auth is used; cookie upgrades still require Origin in handleConnection.
        return callback(null, process.env.NODE_ENV !== 'production');
      }
      return callback(null, allowed.includes(normalized));
    },
    credentials: true,
  },
})
export class CrawlerGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CrawlerGateway.name);
  private publisher?: IORedis;
  private subscriber?: IORedis;
  private subscriberReady = false;
  private startup?: Promise<void>;

  /** Active authenticated sockets indexed by socket.id for expiry and revocation enforcement. */
  private readonly activeSockets = new Map<string, Socket>();
  /** Per-socket timers that disconnect clients upon JWT expiration. */
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly queue?: QueueService,
  ) {}

  onModuleInit(): void {
    if (!this.queue) return;
    this.startup = this.queue.ready.then(() => this.setupRedisBridge());
  }

  private async setupRedisBridge(): Promise<void> {
    const redis = this.queue?.getRedisClient();
    if (!redis) return;
    this.publisher = redis;

    // Headless worker processes publish events to Redis; API processes subscribe and fan out to browser sockets.
    if (process.env.WORKER_MODE === 'true') {
      this.logger.log('Worker realtime Redis Pub/Sub publisher enabled.');
      return;
    }

    try {
      const sub = redis.duplicate({ maxRetriesPerRequest: null });
      sub.on('error', (err) => {
        this.logger.warn(`Realtime Pub/Sub subscriber error: ${err.message}`);
      });
      sub.on('message', (channel, raw) => {
        if (channel !== REALTIME_PUBSUB_CHANNEL) return;
        try {
          const msg = JSON.parse(raw) as RealtimeBroadcastMessage;
          this.emitLocal(msg);
        } catch (err) {
          this.logger.warn(`Malformed realtime Pub/Sub message: ${(err as Error).message}`);
        }
      });
      await sub.subscribe(REALTIME_PUBSUB_CHANNEL);
      this.subscriber = sub;
      this.subscriberReady = true;
      this.logger.log('API realtime Redis Pub/Sub bridge subscribed.');
    } catch (err) {
      this.logger.warn(`Realtime Redis Pub/Sub unavailable; using local WebSocket emit (${(err as Error).message}).`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.startup?.catch(() => undefined);
    this.subscriberReady = false;
    for (const timer of this.expiryTimers.values()) {
      clearTimeout(timer);
    }
    this.expiryTimers.clear();
    this.activeSockets.clear();
    if (this.subscriber) {
      try {
        await this.subscriber.unsubscribe(REALTIME_PUBSUB_CHANNEL);
        await this.subscriber.quit();
      } catch {
        // ignore shutdown error
      }
      this.subscriber = undefined;
    }
  }

  private emitLocal(msg: RealtimeBroadcastMessage): void {
    if (msg.kind === 'access.revoked') {
      this.evictLocalAccess(msg.userId, msg.organizationId);
      return;
    }

    // Prune any connected socket whose token expired before emitting room updates.
    this.disconnectExpiredSockets();

    if (!this.server) return;
    switch (msg.kind) {
      case 'crawl.progress':
        this.server.to(`crawl:${msg.jobId}`).emit(`crawl.progress.${msg.jobId}`, msg.payload);
        break;
      case 'crawl.completed':
        this.server.to(`crawl:${msg.jobId}`).emit(`crawl.completed.${msg.jobId}`, msg.payload);
        break;
      case 'findings.updated':
        this.server.to(`project:${msg.projectId}`).emit(`findings.updated.${msg.projectId}`, msg.payload);
        break;
      case 'aiva.progress':
        this.server.to(`aiva:${msg.sessionId}`).emit(`aiva.progress.${msg.sessionId}`, msg.payload);
        break;
    }
  }

  private publishOrEmit(msg: RealtimeBroadcastMessage): void {
    if (this.publisher && (process.env.WORKER_MODE === 'true' || this.subscriberReady)) {
      void this.publisher.publish(REALTIME_PUBSUB_CHANNEL, JSON.stringify(msg)).catch(() => {
        this.emitLocal(msg);
      });
      return;
    }
    this.emitLocal(msg);
  }

  private clearExpiryTimer(socketId: string): void {
    const timer = this.expiryTimers.get(socketId);
    if (timer) {
      clearTimeout(timer);
      this.expiryTimers.delete(socketId);
    }
  }

  private scheduleExpiryDisconnect(client: Socket, expSeconds: number | undefined): void {
    this.clearExpiryTimer(client.id);
    const delayMs =
      typeof expSeconds === 'number' && Number.isFinite(expSeconds)
        ? Math.max(0, expSeconds * 1000 - Date.now())
        : MAX_SOCKET_SESSION_MS;

    const timer = setTimeout(() => {
      this.expiryTimers.delete(client.id);
      this.activeSockets.delete(client.id);
      this.logger.log(`Disconnecting socket ${client.id}: access token expired`);
      client.disconnect(true);
    }, delayMs);
    timer.unref?.();
    this.expiryTimers.set(client.id, timer);
  }

  private disconnectExpiredSockets(): void {
    const now = Date.now();
    for (const [id, socket] of this.activeSockets.entries()) {
      const exp = socket.data?.tokenExp as number | undefined;
      if (typeof exp === 'number' && exp * 1000 <= now) {
        this.clearExpiryTimer(id);
        this.activeSockets.delete(id);
        socket.disconnect(true);
      }
    }
  }

  private evictLocalAccess(userId: string, organizationId?: string): void {
    for (const [id, socket] of this.activeSockets.entries()) {
      if (socket.data?.userId !== userId) continue;

      if (!organizationId) {
        // Full session revocation: disconnect the socket completely.
        this.clearExpiryTimer(id);
        this.activeSockets.delete(id);
        socket.disconnect(true);
        continue;
      }

      const roomsByOrg = socket.data?.roomsByOrg as Map<string, Set<string>> | undefined;
      const rooms = roomsByOrg?.get(organizationId);
      if (rooms && rooms.size > 0) {
        for (const room of rooms) {
          void Promise.resolve(socket.leave?.(room)).catch(() => undefined);
        }
        roomsByOrg!.delete(organizationId);
      }
    }
  }

  /**
   * Immediately revokes all active room subscriptions for a user within an
   * organization (e.g. when removed from the workspace). Propagates across
   * multi-instance API deployments via Redis Pub/Sub.
   */
  revokeOrganizationAccess(userId: string, organizationId: string): void {
    if (!userId || !organizationId) return;
    this.evictLocalAccess(userId, organizationId);
    if (this.publisher && (process.env.WORKER_MODE === 'true' || this.subscriberReady)) {
      void this.publisher
        .publish(
          REALTIME_PUBSUB_CHANNEL,
          JSON.stringify({ kind: 'access.revoked', userId, organizationId } satisfies RealtimeBroadcastMessage),
        )
        .catch(() => undefined);
    }
  }

  /** Immediately disconnects all active sockets belonging to a user (e.g. session revocation). */
  revokeUserAccess(userId: string): void {
    if (!userId) return;
    this.evictLocalAccess(userId);
    if (this.publisher && (process.env.WORKER_MODE === 'true' || this.subscriberReady)) {
      void this.publisher
        .publish(
          REALTIME_PUBSUB_CHANNEL,
          JSON.stringify({ kind: 'access.revoked', userId } satisfies RealtimeBroadcastMessage),
        )
        .catch(() => undefined);
    }
  }

  private async verifyNotInvalidated(userId: string, tokenIatSeconds: number | undefined): Promise<boolean> {
    if (!this.prisma?.user?.findUnique) return true;
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { sessionsInvalidatedAt: true },
      });
      if (!user) return false;
      if (user.sessionsInvalidatedAt) {
        const iatMs = typeof tokenIatSeconds === 'number' ? tokenIatSeconds * 1000 : 0;
        if (iatMs < user.sessionsInvalidatedAt.getTime()) {
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  handleConnection(client: Socket) {
    const { token, viaCookie } = tokenFromHandshake(client);
    const originHeader = client.handshake.headers?.origin as string | undefined;
    const hostHeader = (client.handshake.headers?.['x-forwarded-host'] ||
      client.handshake.headers?.host) as string | undefined;

    if (!isOriginAllowed(originHeader, hostHeader, viaCookie)) {
      this.logger.warn(
        `Rejected WebSocket ${client.id} from disallowed origin "${originHeader ?? '<missing>'}" (cookieAuth=${viaCookie})`,
      );
      client.disconnect(true);
      return;
    }

    try {
      if (!token) throw new Error('missing token');
      const payload = jwt.verify(token, jwtSecret()) as { sub?: string; type?: string; exp?: number; iat?: number };
      // A refresh token must never authenticate a connection.
      if (!payload.sub || payload.type === 'refresh') throw new Error('invalid token');
      if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) {
        throw new Error('expired token');
      }

      client.data.userId = payload.sub;
      client.data.tokenExp = payload.exp;
      client.data.tokenIat = payload.iat;
      client.data.roomsByOrg = new Map<string, Set<string>>();

      this.activeSockets.set(client.id, client);
      this.scheduleExpiryDisconnect(client, payload.exp);

      // Asynchronously verify user has not had all sessions invalidated (e.g. account reclaim / revoke).
      void this.verifyNotInvalidated(payload.sub, payload.iat).then((valid) => {
        if (!valid && this.activeSockets.has(client.id)) {
          this.logger.warn(`Disconnecting socket ${client.id}: session invalidated`);
          this.clearExpiryTimer(client.id);
          this.activeSockets.delete(client.id);
          client.disconnect(true);
        }
      });
    } catch {
      this.logger.warn(`Rejected unauthenticated socket ${client.id}`);
      client.disconnect(true);
      return;
    }
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.clearExpiryTimer(client.id);
    this.activeSockets.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private trackOrgRoom(client: Socket, organizationId: string, room: string): void {
    if (!this.activeSockets.has(client.id)) {
      this.activeSockets.set(client.id, client);
    }
    let roomsByOrg = client.data.roomsByOrg as Map<string, Set<string>> | undefined;
    if (!roomsByOrg) {
      roomsByOrg = new Map<string, Set<string>>();
      client.data.roomsByOrg = roomsByOrg;
    }
    let set = roomsByOrg.get(organizationId);
    if (!set) {
      set = new Set<string>();
      roomsByOrg.set(organizationId, set);
    }
    set.add(room);
  }

  /** True while the token the socket connected with is still valid. */
  private stillAuthenticated(client: Socket): boolean {
    const exp = client.data.tokenExp as number | undefined;
    const valid = Boolean(client.data.userId) && (!exp || exp * 1000 > Date.now());
    if (!valid && this.activeSockets.has(client.id)) {
      this.clearExpiryTimer(client.id);
      this.activeSockets.delete(client.id);
      client.disconnect(true);
    }
    return valid;
  }

  private async isMember(userId: string, organizationId: string | null | undefined): Promise<boolean> {
    if (!organizationId) return false;
    const member = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { id: true },
    });
    return Boolean(member);
  }

  private async crawlOrganization(jobId: string): Promise<string | null> {
    const job = await this.prisma.crawlJob.findUnique({
      where: { id: jobId },
      select: { website: { select: { scope: true, project: { select: { organizationId: true } } } } },
    });
    if (!job) return null;
    if (job.website.project) return job.website.project.organizationId;
    // A competitor site has no project of its own; its scope names the owning project.
    const match = /^competitor:(.+)$/.exec(job.website.scope ?? '');
    if (!match) return null;
    const project = await this.prisma.project.findUnique({
      where: { id: match[1] },
      select: { organizationId: true },
    });
    return project?.organizationId ?? null;
  }

  @SubscribeMessage('subscribe.crawl')
  async subscribeCrawl(@ConnectedSocket() client: Socket, @MessageBody() body: { jobId?: string }) {
    const jobId = body?.jobId;
    if (!this.stillAuthenticated(client) || typeof jobId !== 'string' || !ID_PATTERN.test(jobId)) {
      return { ok: false };
    }
    if (!(await this.verifyNotInvalidated(client.data.userId, client.data.tokenIat))) {
      client.disconnect(true);
      return { ok: false };
    }
    const organizationId = await this.crawlOrganization(jobId);
    if (!organizationId || !(await this.isMember(client.data.userId, organizationId))) return { ok: false };
    const room = `crawl:${jobId}`;
    await client.join(room);
    this.trackOrgRoom(client, organizationId, room);
    return { ok: true };
  }

  @SubscribeMessage('subscribe.aiva')
  async subscribeAiva(@ConnectedSocket() client: Socket, @MessageBody() body: { sessionId?: string }) {
    const sessionId = body?.sessionId;
    if (!this.stillAuthenticated(client) || typeof sessionId !== 'string' || !ID_PATTERN.test(sessionId)) {
      return { ok: false };
    }
    if (!(await this.verifyNotInvalidated(client.data.userId, client.data.tokenIat))) {
      client.disconnect(true);
      return { ok: false };
    }
    const session = await this.prisma.voiceSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });
    if (!session || session.userId !== client.data.userId) return { ok: false };
    await client.join(`aiva:${sessionId}`);
    return { ok: true };
  }

  @SubscribeMessage('subscribe.project')
  async subscribeProject(@ConnectedSocket() client: Socket, @MessageBody() body: { projectId?: string }) {
    const projectId = body?.projectId;
    if (!this.stillAuthenticated(client) || typeof projectId !== 'string' || !ID_PATTERN.test(projectId)) {
      return { ok: false };
    }
    if (!(await this.verifyNotInvalidated(client.data.userId, client.data.tokenIat))) {
      client.disconnect(true);
      return { ok: false };
    }
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project || !(await this.isMember(client.data.userId, project.organizationId))) {
      return { ok: false };
    }
    const room = `project:${projectId}`;
    await client.join(room);
    this.trackOrgRoom(client, project.organizationId, room);
    return { ok: true };
  }

  broadcastProgress(jobId: string, progress: any) {
    this.publishOrEmit({ kind: 'crawl.progress', jobId, payload: progress });
  }

  broadcastComplete(jobId: string, result: any) {
    this.publishOrEmit({ kind: 'crawl.completed', jobId, payload: result });
  }

  /** Notifies connected clients in a project room that Fix Engine findings/plans changed. */
  broadcastFindingsUpdated(projectId: string, payload: FindingsUpdatedPayload) {
    this.publishOrEmit({ kind: 'findings.updated', projectId, payload });
  }

  /** Streams Aiva voice-agent job progress to a specific session's client. */
  broadcastVoiceProgress(sessionId: string, payload: { tool: string; status: string; message: string; data?: any }) {
    this.publishOrEmit({ kind: 'aiva.progress', sessionId, payload });
  }
}
