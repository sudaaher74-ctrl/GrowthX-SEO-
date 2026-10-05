import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

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

@WebSocketGateway({
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const allowed = allowedOrigins();
      if (allowed === false) return callback(null, false);
      if (!origin || (Array.isArray(allowed) && (allowed.includes(origin) || allowed.includes('*')))) {
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

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  broadcastProgress(jobId: string, progress: any) {
    if (this.server) {
      this.server.emit(`crawl.progress.${jobId}`, progress);
    }
  }

  broadcastComplete(jobId: string, result: any) {
    if (this.server) {
      this.server.emit(`crawl.completed.${jobId}`, result);
    }
  }

  /** Streams Aiva voice-agent job progress to a specific session's client. */
  broadcastVoiceProgress(sessionId: string, payload: { tool: string; status: string; message: string; data?: any }) {
    if (this.server) {
      this.server.emit(`aiva.progress.${sessionId}`, payload);
    }
  }
}
