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

export const REALTIME_PUBSUB_CHANNEL = 'growthx:realtime:events';

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
  | { kind: 'aiva.progress'; sessionId: string; payload: { tool: string; status: string; message: string; data?: unknown } };

function allowedOrigins(): string[] | boolean {
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.length > 0) return configured;
  if (process.env.NODE_ENV !== 'production') {
    return ['http://localhost:3000', 'http://localhost:3001'];
  }
  return false;
}

/** Pulls the access token from the handshake: explicit auth payload first, then the HttpOnly cookie. */
function tokenFromHandshake(client: Socket): string | null {
  const fromAuth = (client.handshake.auth as { token?: unknown } | undefined)?.token;
  if (typeof fromAuth === 'string' && fromAuth) return fromAuth;
  const header = client.handshake.headers.cookie;
  if (header) {
    const match = /(?:^|;\s*)access_token=([^;]+)/.exec(header);
    if (match) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return null;
      }
    }
  }
  return null;
}

const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Real-time progress channel.
 *
 * Every connection must present a valid access token. Events are never
 * broadcast to all clients: they go to a room per crawl job or voice session,
 * and a client can only join a room after the server has checked that the job
 * or session belongs to an organization the caller is a member of.
 */
@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowed = allowedOrigins();
      if (allowed === false) return callback(null, false);
      if (!origin || (Array.isArray(allowed) && allowed.includes(origin))) {
        return callback(null, true);
      }
      return callback(null, false);
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

  handleConnection(client: Socket) {
    const token = tokenFromHandshake(client);
    try {
      if (!token) throw new Error('missing token');
      const payload = jwt.verify(token, jwtSecret()) as { sub?: string; type?: string };
      // A refresh token must never authenticate a connection.
      if (!payload.sub || payload.type === 'refresh') throw new Error('invalid token');
      client.data.userId = payload.sub;
      client.data.tokenExp = (payload as { exp?: number }).exp;
    } catch {
      this.logger.warn(`Rejected unauthenticated socket ${client.id}`);
      client.disconnect(true);
      return;
    }
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** True while the token the socket connected with is still valid. */
  private stillAuthenticated(client: Socket): boolean {
    const exp = client.data.tokenExp as number | undefined;
    return Boolean(client.data.userId) && (!exp || exp * 1000 > Date.now());
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
    const organizationId = await this.crawlOrganization(jobId);
    if (!(await this.isMember(client.data.userId, organizationId))) return { ok: false };
    await client.join(`crawl:${jobId}`);
    return { ok: true };
  }

  @SubscribeMessage('subscribe.aiva')
  async subscribeAiva(@ConnectedSocket() client: Socket, @MessageBody() body: { sessionId?: string }) {
    const sessionId = body?.sessionId;
    if (!this.stillAuthenticated(client) || typeof sessionId !== 'string' || !ID_PATTERN.test(sessionId)) {
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
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project || !(await this.isMember(client.data.userId, project.organizationId))) {
      return { ok: false };
    }
    await client.join(`project:${projectId}`);
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
