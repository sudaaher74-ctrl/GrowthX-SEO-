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
import { Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../database/prisma.service';
import { jwtSecret } from '../../config/secrets';

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
export class CrawlerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(CrawlerGateway.name);

  constructor(private readonly prisma: PrismaService) {}

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

  broadcastProgress(jobId: string, progress: any) {
    this.server?.to(`crawl:${jobId}`).emit(`crawl.progress.${jobId}`, progress);
  }

  broadcastComplete(jobId: string, result: any) {
    this.server?.to(`crawl:${jobId}`).emit(`crawl.completed.${jobId}`, result);
  }

  /** Streams Aiva voice-agent job progress to a specific session's client. */
  broadcastVoiceProgress(sessionId: string, payload: { tool: string; status: string; message: string; data?: any }) {
    this.server?.to(`aiva:${sessionId}`).emit(`aiva.progress.${sessionId}`, payload);
  }
}
