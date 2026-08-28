import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../../../database/prisma.service';
import { decryptToken, encryptToken, tokenEncryptionAvailable } from './token-crypto';
import { decodeState, encodeState } from './oauth-state';
import { GOOGLE_PROVIDERS, GoogleProviderId } from './google-provider';

/**
 * The one place a Google connection is created, refreshed, read and removed.
 *
 * Search Console, Analytics and Business Profile differ only in scope and in
 * what the customer picks afterwards, so the OAuth round trip lives here once
 * rather than being copied per service — the existing Business Profile
 * connector is a copy of exactly this logic, and it is the copy that shipped
 * with plaintext tokens and an unsigned state. Adding Google Ads later should
 * be an entry in GOOGLE_PROVIDERS, not another copy.
 *
 * Connection status is stored rather than inferred, because "the refresh token
 * was revoked" looks identical to "connected" from the columns alone, and the
 * difference is the whole message the customer needs.
 */
@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Whether this deployment can connect Google at all.
   *
   * Checked before showing a Connect button. The client id and secret are
   * created by whoever owns the deployment in Google Cloud; without them the
   * flow fails at Google's end with an error the customer cannot act on, so it
   * is better to say the feature is not configured.
   */
  configuration(): { configured: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!process.env.GOOGLE_CLIENT_ID) missing.push('GOOGLE_CLIENT_ID');
    if (!process.env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET');
    if (!tokenEncryptionAvailable()) missing.push('INTEGRATION_TOKEN_KEY');
    return { configured: missing.length === 0, missing };
  }

  private redirectUri(): string {
    const base = process.env.GOOGLE_REDIRECT_URI || process.env.API_BASE_URL;
    if (!base) {
      throw new ServiceUnavailableException(
        'GOOGLE_REDIRECT_URI is not set, so Google cannot return the customer to this deployment.',
      );
    }
    // One callback for every Google provider; which one is in the state.
    return base.endsWith('/callback') ? base : `${base.replace(/\/$/, '')}/api/integrations/google/callback`;
  }

  private client(): OAuth2Client {
    const { configured, missing } = this.configuration();
    if (!configured) {
      throw new ServiceUnavailableException(
        `Google integrations are not configured on this deployment. Missing: ${missing.join(', ')}.`,
      );
    }
    return new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, this.redirectUri());
  }

  /** The URL to send the customer to. */
  authorizationUrl(input: {
    provider: GoogleProviderId;
    projectId: string;
    organizationId: string;
    returnTo?: string;
  }): string {
    const provider = GOOGLE_PROVIDERS[input.provider];
    if (!provider) throw new BadRequestException(`Unknown Google provider "${input.provider}".`);

    return this.client().generateAuthUrl({
      access_type: 'offline',
      // Without this Google returns a refresh token only on the very first
      // authorization ever granted for the account, so a customer who
      // disconnects and reconnects ends up with an access token that expires
      // in an hour and no way to renew it.
      prompt: 'consent',
      include_granted_scopes: true,
      scope: provider.scopes,
      state: encodeState({
        provider: input.provider,
        projectId: input.projectId,
        organizationId: input.organizationId,
        returnTo: input.returnTo,
      }),
    });
  }

  /**
   * Exchanges the code Google returned for tokens and stores the connection.
   *
   * The state is verified before anything is written — it is the only thing
   * tying this request to the one that started it, since a browser redirect
   * carries no bearer token.
   */
  async completeAuthorization(input: { code: string; state: string }) {
    const state = decodeState(input.state);
    const provider = GOOGLE_PROVIDERS[state.provider as GoogleProviderId];
    if (!provider) throw new BadRequestException('OAuth state names a provider that does not exist.');

    // Confirms the project still exists and still belongs to the organization
    // the state claims. A stale link from a deleted project must not write.
    const project = await this.prisma.project.findFirst({
      where: { id: state.projectId, organizationId: state.organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('The project this authorization was started from no longer exists.');

    const { tokens } = await this.client().getToken(input.code);
    if (!tokens.access_token) {
      throw new BadRequestException('Google did not return an access token.');
    }

    // Google returns a refresh token only when it feels like it. Reusing the
    // stored one keeps a reconnect from silently downgrading a durable
    // connection to a one-hour one.
    const existing = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId: state.projectId, provider: state.provider } },
    });
    const refreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : (existing?.refreshToken ?? null);

    const granted = (tokens.scope ?? '').split(' ').filter(Boolean);
    // A customer can untick a scope on the consent screen. Better to find out
    // here than when the first sync returns 403.
    const missingScopes = provider.scopes.filter((scope) => granted.length > 0 && !granted.includes(scope));

    const integration = await this.prisma.integration.upsert({
      where: { projectId_provider: { projectId: state.projectId, provider: state.provider } },
      update: {
        accessToken: encryptToken(tokens.access_token),
        refreshToken,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        grantedScopes: granted,
        status: missingScopes.length > 0 ? 'ERROR' : 'NEEDS_SELECTION',
        statusMessage:
          missingScopes.length > 0
            ? `Google did not grant the access needed to read your ${provider.label} data. Reconnect and accept all requested permissions.`
            : null,
      },
      create: {
        projectId: state.projectId,
        provider: state.provider,
        accessToken: encryptToken(tokens.access_token),
        refreshToken,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        grantedScopes: granted,
        status: missingScopes.length > 0 ? 'ERROR' : 'NEEDS_SELECTION',
        statusMessage:
          missingScopes.length > 0
            ? `Google did not grant the access needed to read your ${provider.label} data. Reconnect and accept all requested permissions.`
            : null,
      },
    });

    await this.record(integration.id, state.projectId, 'CONNECTED', `${provider.label} authorized.`);

    return { integration, provider, returnTo: state.returnTo, missingScopes };
  }

  /**
   * An authenticated client for a connected provider, refreshing if needed.
   *
   * Callers get a client or an exception — never a stale one that fails later
   * inside an API call where the cause is harder to read.
   */
  async clientFor(projectId: string, providerId: GoogleProviderId): Promise<OAuth2Client> {
    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: providerId } },
    });
    if (!integration || integration.status === 'DISCONNECTED') {
      throw new NotFoundException(`${GOOGLE_PROVIDERS[providerId].label} is not connected for this project.`);
    }
    if (integration.status === 'NEEDS_REAUTH') {
      throw new ServiceUnavailableException(
        `${GOOGLE_PROVIDERS[providerId].label} needs to be reconnected before it can be read.`,
      );
    }

    const client = this.client();
    let credentials: { access_token: string; refresh_token?: string };
    try {
      credentials = {
        access_token: decryptToken(integration.accessToken),
        refresh_token: integration.refreshToken ? decryptToken(integration.refreshToken) : undefined,
      };
    } catch {
      // Either a token written before encryption existed, or one the current
      // key cannot open. Both mean the same thing to the customer, and both
      // are a reconnect rather than a stack trace: an unreadable token is not
      // a bug to retry, it is a grant we no longer hold.
      await this.markNeedsReauth(projectId, providerId, 'Stored token could not be read.');
      throw new ServiceUnavailableException(
        `${GOOGLE_PROVIDERS[providerId].label} needs to be reconnected before it can be read.`,
      );
    }

    client.setCredentials({
      ...credentials,
      expiry_date: integration.expiresAt?.getTime() ?? null,
    });

    // google-auth-library refreshes on demand and emits the new credentials.
    // Persisting them here is what keeps the next request from refreshing
    // again, and what makes a revoked grant visible.
    client.on('tokens', (fresh) => {
      void this.prisma.integration
        .update({
          where: { id: integration.id },
          data: {
            ...(fresh.access_token ? { accessToken: encryptToken(fresh.access_token) } : {}),
            ...(fresh.refresh_token ? { refreshToken: encryptToken(fresh.refresh_token) } : {}),
            ...(fresh.expiry_date ? { expiresAt: new Date(fresh.expiry_date) } : {}),
            status: 'CONNECTED',
            statusMessage: null,
          },
        })
        .catch((error) => this.logger.error(`Could not persist refreshed Google token: ${error.message}`));
    });

    return client;
  }

  /**
   * Marks a connection as needing the customer's attention.
   *
   * Called when Google rejects the credentials — a revoked grant, a changed
   * password, a removed app. One integration in this state must not stop the
   * others working or make the dashboard look broken.
   */
  async markNeedsReauth(projectId: string, providerId: GoogleProviderId, reason: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: providerId } },
      select: { id: true },
    });
    if (!integration) return;

    await this.prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: 'NEEDS_REAUTH',
        statusMessage: `Authorization expired or was revoked. Reconnect ${GOOGLE_PROVIDERS[providerId].label} to resume syncing.`,
      },
    });
    await this.record(integration.id, projectId, 'REAUTH_REQUIRED', reason);
  }

  /** Records which property, or location, the customer chose. */
  async selectResource(projectId: string, providerId: GoogleProviderId, resource: { id: string; name: string }) {
    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: providerId } },
      select: { id: true },
    });
    if (!integration) throw new NotFoundException(`${GOOGLE_PROVIDERS[providerId].label} is not connected.`);

    const updated = await this.prisma.integration.update({
      where: { id: integration.id },
      data: {
        selectedResourceId: resource.id,
        selectedResourceName: resource.name,
        status: 'CONNECTED',
        statusMessage: null,
      },
    });
    await this.record(integration.id, projectId, 'RESOURCE_SELECTED', resource.name);
    return updated;
  }

  /**
   * Removes a connection and the tokens with it.
   *
   * The grant is revoked at Google as well as deleted here. Deleting our row
   * alone would leave the customer's Google account still granting this
   * application access, with nothing in their Google settings to explain why.
   * A revoke that fails does not stop the delete — the customer asked to
   * disconnect, and leaving the tokens because Google was unreachable is the
   * wrong way to fail.
   */
  async disconnect(projectId: string, providerId: GoogleProviderId, actorUserId?: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: providerId } },
    });
    if (!integration) return { disconnected: false };

    let revoked = false;
    try {
      if (integration.refreshToken) {
        await this.client().revokeToken(decryptToken(integration.refreshToken));
        revoked = true;
      }
    } catch (error: any) {
      this.logger.warn(`Could not revoke Google token at Google: ${error.message}`);
    }

    await this.record(
      integration.id,
      projectId,
      'DISCONNECTED',
      revoked ? 'Disconnected and revoked at Google.' : 'Disconnected locally; revoke at Google did not succeed.',
      actorUserId,
    );

    await this.prisma.integration.delete({ where: { id: integration.id } });
    return { disconnected: true, revoked };
  }

  /** Connection status for every Google provider, for the integrations page. */
  async statusFor(projectId: string) {
    const rows = await this.prisma.integration.findMany({
      where: { projectId, provider: { in: Object.keys(GOOGLE_PROVIDERS) } },
    });
    const byProvider = new Map(rows.map((row) => [row.provider, row]));

    return {
      configuration: this.configuration(),
      providers: Object.values(GOOGLE_PROVIDERS).map((provider) => {
        const row = byProvider.get(provider.id);
        return {
          id: provider.id,
          label: provider.label,
          requiresGoogleApproval: provider.requiresGoogleApproval,
          selectionLabel: provider.selectionLabel,
          // NOT_CONNECTED is a first-class state, not an error. A dashboard
          // that renders an unconnected source as zeroes reads as broken.
          status: row?.status ?? 'NOT_CONNECTED',
          statusMessage: row?.statusMessage ?? null,
          selectedResourceId: row?.selectedResourceId ?? null,
          selectedResourceName: row?.selectedResourceName ?? null,
          googleAccountEmail: row?.googleAccountEmail ?? null,
          lastSyncedAt: row?.lastSyncedAt ?? null,
          nextSyncAt: row?.nextSyncAt ?? null,
        };
      }),
    };
  }

  /** Append-only; never carries a token or a raw API payload. */
  private async record(
    integrationId: string,
    projectId: string,
    event: string,
    detail?: string,
    actorUserId?: string,
  ) {
    await this.prisma.integrationAuditEvent
      .create({ data: { integrationId, projectId, event, detail, actorUserId } })
      .catch((error) => this.logger.error(`Could not write integration audit event: ${error.message}`));
  }
}
