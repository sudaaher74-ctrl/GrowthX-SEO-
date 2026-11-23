import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import * as net from 'net';
import { PrismaService } from '../../database/prisma.service';
import { SecurityService } from '../security/security.service';
import { assertPublicUrl, isPrivateAddress, safePublicFetch, SsrfBlockedError } from '../security/ssrf';

export type WebhookChannel = 'SLACK' | 'DISCORD' | 'REST';

export type WebhookEventKey =
  | 'healthDrop'
  | 'regressionDetected'
  | 'crawlCompleted'
  | 'fixRolledBack'
  | 'monthlyReportLocked';

export interface WebhookEventsMatrix {
  healthDrop: boolean;
  regressionDetected: boolean;
  crawlCompleted: boolean;
  fixRolledBack: boolean;
  monthlyReportLocked: boolean;
}

export const DEFAULT_WEBHOOK_EVENTS: WebhookEventsMatrix = {
  healthDrop: true,
  regressionDetected: true,
  crawlCompleted: false,
  fixRolledBack: true,
  monthlyReportLocked: false,
};

export interface UpdateWebhookConfigInput {
  enabled?: boolean;
  slackUrl?: string | null;
  discordUrl?: string | null;
  restUrl?: string | null;
  secretToken?: string | null;
  events?: Partial<WebhookEventsMatrix>;
}

export interface WebhookConfigResponse {
  projectId: string;
  enabled: boolean;
  slackUrl: string;
  discordUrl: string;
  restUrl: string;
  hasSecretToken: boolean;
  events: WebhookEventsMatrix;
  updatedAt: string | null;
  logs: Array<{
    id: string;
    channel: string;
    event: string;
    targetHost: string;
    status: string;
    statusCode: number | null;
    latencyMs: number;
    summary: string;
    error: string | null;
    payload: Record<string, unknown>;
    createdAt: string;
  }>;
}

@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly security?: SecurityService,
  ) {}

  private async assertProjectAccess(projectId: string, userId: string, requireWrite = false) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        organizationId: true,
        websites: { select: { domain: true }, take: 1 },
      },
    });
    if (!project) throw new NotFoundException('Project not found.');
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: project.organizationId },
      },
      select: { role: true },
    });
    if (!membership) throw new ForbiddenException('You do not have access to this project.');
    if (requireWrite && membership.role === 'VIEWER') {
      throw new ForbiddenException('Your role in this organization is view-only.');
    }
    return project;
  }

  private normalizeWebhookUrl(raw: string | null | undefined, label: string): string | null {
    const trimmed = (raw ?? '').trim();
    if (!trimmed) return null;
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new BadRequestException(`${label} must be a valid https:// URL.`);
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new BadRequestException(`${label} must use https:// or http://.`);
    }
    if (parsed.username || parsed.password) {
      throw new BadRequestException(`${label} must not embed credentials in the URL.`);
    }
    const host = parsed.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      (net.isIP(host) && isPrivateAddress(host))
    ) {
      throw new BadRequestException(`${label}: Refusing internal or private address (${host}).`);
    }
    try {
      assertPublicUrl(parsed.toString());
    } catch (err) {
      if (err instanceof SsrfBlockedError) {
        throw new BadRequestException(`${label}: ${err.message}`);
      }
      throw err;
    }
    return parsed.toString();
  }

  private parseEvents(raw: unknown): WebhookEventsMatrix {
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
    return {
      healthDrop: typeof obj.healthDrop === 'boolean' ? obj.healthDrop : DEFAULT_WEBHOOK_EVENTS.healthDrop,
      regressionDetected:
        typeof obj.regressionDetected === 'boolean'
          ? obj.regressionDetected
          : DEFAULT_WEBHOOK_EVENTS.regressionDetected,
      crawlCompleted:
        typeof obj.crawlCompleted === 'boolean' ? obj.crawlCompleted : DEFAULT_WEBHOOK_EVENTS.crawlCompleted,
      fixRolledBack:
        typeof obj.fixRolledBack === 'boolean' ? obj.fixRolledBack : DEFAULT_WEBHOOK_EVENTS.fixRolledBack,
      monthlyReportLocked:
        typeof obj.monthlyReportLocked === 'boolean'
          ? obj.monthlyReportLocked
          : DEFAULT_WEBHOOK_EVENTS.monthlyReportLocked,
    };
  }

  async getConfig(projectId: string, userId: string): Promise<WebhookConfigResponse> {
    await this.assertProjectAccess(projectId, userId);

    const [cfg, logs] = await Promise.all([
      this.prisma.projectWebhookConfig.findUnique({ where: { projectId } }),
      this.prisma.webhookDeliveryLog.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
    ]);

    return {
      projectId,
      enabled: cfg?.enabled ?? true,
      slackUrl: cfg?.slackUrl ?? '',
      discordUrl: cfg?.discordUrl ?? '',
      restUrl: cfg?.restUrl ?? '',
      hasSecretToken: Boolean(cfg?.secretToken),
      events: this.parseEvents(cfg?.events),
      updatedAt: cfg?.updatedAt?.toISOString() ?? null,
      logs: logs.map((l) => ({
        id: l.id,
        channel: l.channel,
        event: l.event,
        targetHost: l.targetHost,
        status: l.status,
        statusCode: l.statusCode,
        latencyMs: l.latencyMs,
        summary: l.summary,
        error: l.error,
        payload:
          l.payload && typeof l.payload === 'object'
            ? (l.payload as Record<string, unknown>)
            : {},
        createdAt: l.createdAt.toISOString(),
      })),
    };
  }

  async saveConfig(
    projectId: string,
    userId: string,
    input: UpdateWebhookConfigInput,
  ): Promise<WebhookConfigResponse> {
    await this.assertProjectAccess(projectId, userId, true);

    const existing = await this.prisma.projectWebhookConfig.findUnique({ where: { projectId } });
    const slackUrl =
      input.slackUrl !== undefined
        ? this.normalizeWebhookUrl(input.slackUrl, 'Slack webhook URL')
        : (existing?.slackUrl ?? null);
    const discordUrl =
      input.discordUrl !== undefined
        ? this.normalizeWebhookUrl(input.discordUrl, 'Discord webhook URL')
        : (existing?.discordUrl ?? null);
    const restUrl =
      input.restUrl !== undefined
        ? this.normalizeWebhookUrl(input.restUrl, 'Custom REST webhook URL')
        : (existing?.restUrl ?? null);

    let secretToken = existing?.secretToken ?? null;
    if (input.secretToken !== undefined) {
      const cleaned = (input.secretToken ?? '').trim();
      if (!cleaned) {
        secretToken = null;
      } else {
        secretToken = this.security ? this.security.encryptCredentials(cleaned) : cleaned;
      }
    }

    const nextEvents: WebhookEventsMatrix = {
      ...this.parseEvents(existing?.events),
      ...(input.events ?? {}),
    };

    await this.prisma.projectWebhookConfig.upsert({
      where: { projectId },
      create: {
        projectId,
        enabled: input.enabled ?? true,
        slackUrl,
        discordUrl,
        restUrl,
        secretToken,
        events: nextEvents as any,
      },
      update: {
        enabled: input.enabled ?? existing?.enabled ?? true,
        slackUrl,
        discordUrl,
        restUrl,
        secretToken,
        events: nextEvents as any,
      },
    });

    return this.getConfig(projectId, userId);
  }

  async clearLogs(projectId: string, userId: string): Promise<{ cleared: number }> {
    await this.assertProjectAccess(projectId, userId, true);
    const res = await this.prisma.webhookDeliveryLog.deleteMany({ where: { projectId } });
    return { cleared: res.count };
  }

  /**
   * Sends a REAL SSRF-checked HTTP POST to the configured channel and persists
   * the actual HTTP response status & latency in WebhookDeliveryLog.
   */
  async sendTestWebhook(
    projectId: string,
    userId: string,
    channel: WebhookChannel,
  ) {
    const project = await this.assertProjectAccess(projectId, userId, true);
    const cfg = await this.prisma.projectWebhookConfig.findUnique({ where: { projectId } });
    const targetUrl =
      channel === 'SLACK'
        ? cfg?.slackUrl
        : channel === 'DISCORD'
          ? cfg?.discordUrl
          : cfg?.restUrl;

    if (!targetUrl) {
      throw new BadRequestException(
        `No ${channel} webhook URL is saved yet. Paste your ${channel} endpoint URL and click Save Webhook Endpoints first.`,
      );
    }

    const domain = project.websites[0]?.domain ?? project.name;
    const secret =
      channel === 'REST' && cfg?.secretToken
        ? this.security?.decryptCredentials(cfg.secretToken) ?? cfg.secretToken
        : null;

    return this.deliverToChannel({
      projectId,
      channel,
      targetUrl,
      secret,
      event: 'reigel.webhook.test',
      summary: `Test webhook verification for ${domain}`,
      details: {
        projectId,
        projectName: project.name,
        domain,
        test: true,
      },
    });
  }

  /**
   * Fire-and-forget safe alert dispatcher called by Regression Guard, Rollback,
   * Crawl completion, and Monthly Snapshot auto-freeze.
   */
  async dispatchProjectEvent(
    projectId: string,
    eventKey: WebhookEventKey,
    summary: string,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      if (!this.prisma.projectWebhookConfig?.findUnique) return;
      const cfg = await this.prisma.projectWebhookConfig.findUnique({ where: { projectId } });
      if (!cfg || !cfg.enabled) return;
      const events = this.parseEvents(cfg.events);
      if (!events[eventKey]) return;

      const deliveries: Promise<unknown>[] = [];
      const eventName = `reigel.${eventKey}`;

      if (cfg.slackUrl) {
        deliveries.push(
          this.deliverToChannel({
            projectId,
            channel: 'SLACK',
            targetUrl: cfg.slackUrl,
            secret: null,
            event: eventName,
            summary,
            details,
          }),
        );
      }
      if (cfg.discordUrl) {
        deliveries.push(
          this.deliverToChannel({
            projectId,
            channel: 'DISCORD',
            targetUrl: cfg.discordUrl,
            secret: null,
            event: eventName,
            summary,
            details,
          }),
        );
      }
      if (cfg.restUrl) {
        const secret = cfg.secretToken
          ? this.security?.decryptCredentials(cfg.secretToken) ?? cfg.secretToken
          : null;
        deliveries.push(
          this.deliverToChannel({
            projectId,
            channel: 'REST',
            targetUrl: cfg.restUrl,
            secret,
            event: eventName,
            summary,
            details,
          }),
        );
      }

      await Promise.allSettled(deliveries);
    } catch (err) {
      this.logger.warn(`[${projectId}] Webhook dispatch error (${eventKey}): ${(err as Error).message}`);
    }
  }

  private async deliverToChannel(params: {
    projectId: string;
    channel: WebhookChannel;
    targetUrl: string;
    secret: string | null;
    event: string;
    summary: string;
    details: Record<string, unknown>;
  }) {
    const { projectId, channel, targetUrl, secret, event, summary, details } = params;
    let host = 'unknown';
    try {
      host = new URL(targetUrl).hostname;
    } catch {
      host = 'invalid';
    }

    const start = Date.now();
    const timestamp = new Date().toISOString();

    const bodyObj: Record<string, unknown> =
      channel === 'SLACK'
        ? {
            text: `*[Reigel SEO]* ${summary}`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*[Reigel SEO · ${event}]*\n${summary}`,
                },
              },
            ],
          }
        : channel === 'DISCORD'
          ? {
              content: `**[Reigel SEO · ${event}]** ${summary}`,
            }
          : {
              event,
              timestamp,
              projectId,
              summary,
              data: details,
            };

    const rawBody = JSON.stringify(bodyObj);

    let status: 'SUCCESS' | 'FAILED' = 'FAILED';
    let statusCode: number | null = null;
    let errorMsg: string | null = null;

    try {
      assertPublicUrl(targetUrl);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Reigel-SEO-Webhook/1.0',
        'X-Reigel-Event': event,
      };
      if (secret && channel === 'REST') {
        const sig = createHmac('sha256', secret).update(rawBody).digest('hex');
        headers['X-Reigel-Signature'] = `sha256=${sig}`;
      }

      const res = await safePublicFetch(targetUrl, {
        method: 'POST',
        headers,
        body: rawBody,
        maxRedirects: 0,
        timeoutMs: 10000,
        maxBytes: 64 * 1024,
        rejectCrossOriginRedirects: true,
      });

      statusCode = res.status;
      if (res.ok) {
        status = 'SUCCESS';
      } else {
        const text = await res.text().catch(() => '');
        errorMsg = `HTTP ${res.status}${text ? `: ${text.slice(0, 140)}` : ''}`;
      }
    } catch (err) {
      errorMsg = (err as Error)?.message ?? 'Webhook delivery failed';
    }

    const latencyMs = Math.max(1, Date.now() - start);

    const log = await this.prisma.webhookDeliveryLog.create({
      data: {
        projectId,
        channel,
        event,
        targetHost: host,
        status,
        statusCode,
        latencyMs,
        summary,
        error: errorMsg,
        payload: bodyObj as any,
      },
    });

    return {
      id: log.id,
      channel: log.channel,
      event: log.event,
      targetHost: log.targetHost,
      status: log.status,
      statusCode: log.statusCode,
      latencyMs: log.latencyMs,
      summary: log.summary,
      error: log.error,
      payload: bodyObj,
      createdAt: log.createdAt.toISOString(),
    };
  }
}
