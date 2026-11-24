import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
// Deliberately the class googleapis re-exports, not the top-level
// google-auth-library one. The package tree contains both — googleapis-common
// nests its own copy — and they are structurally identical but nominally
// different types, so mixing them makes every google.<api>() call reject the
// client it was just handed.
import { google } from './google-apis';
import type { OAuth2Client } from 'googleapis-common';
import { PrismaService } from '../../../database/prisma.service';
import { OAuthTransactionService } from '../../security/oauth-transaction.service';
import { decryptToken, encryptToken, tokenEncryptionAvailable } from './token-crypto';
import { decodeState, encodeState } from './oauth-state';
import { GOOGLE_PROVIDERS, GoogleProviderId } from './google-provider';

export const GOOGLE_INTEGRATION_TX_PROVIDER = 'google_integration';
export const GOOGLE_INTEGRATION_NONCE_COOKIE = 'oauth_google_int_nonce';

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

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly oauthTransactions?: OAuthTransactionService,
  ) {}

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
      this.logger.error(`Google integration configuration is incomplete: ${missing.join(', ')}`);
      throw new ServiceUnavailableException(
        'Google connections are not configured on this deployment. Ask the service operator to finish the Google integration setup.',
      );
    }
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      this.redirectUri(),
    );
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
      // `openid email` are identity-only scopes that let the connection show
      // which Google account it belongs to. They grant no access to any data.
      scope: [...provider.scopes, 'openid', 'email'],
      state: encodeState({
        provider: input.provider,
        projectId: input.projectId,
        organizationId: input.organizationId,
        returnTo: input.returnTo,
      }),
    });
  }

  /**
   * Starts a browser-bound, expiring, single-use Google data-connector OAuth
   * transaction with PKCE (S256). The caller sets `browserNonce` in an HttpOnly
   * cookie scoped to the callback path.
   */
  async startAuthorization(input: {
    provider: GoogleProviderId;
    projectId: string;
    organizationId: string;
    userId: string;
    returnTo?: string;
  }): Promise<{ authorizationUrl: string; browserNonce: string }> {
    const provider = GOOGLE_PROVIDERS[input.provider];
    if (!provider) throw new BadRequestException(`Unknown Google provider "${input.provider}".`);
    if (!this.oauthTransactions) {
      throw new ServiceUnavailableException('OAuth transaction store is unavailable.');
    }

    const tx = await this.oauthTransactions.createTransaction({
      provider: GOOGLE_INTEGRATION_TX_PROVIDER,
      purpose: input.provider,
      userId: input.userId,
      organizationId: input.organizationId,
      projectId: input.projectId,
      returnTo: input.returnTo,
      usePkce: true,
    });

    const authorizationUrl = this.client().generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
      scope: [...provider.scopes, 'openid', 'email'],
      state: tx.state,
      ...(tx.codeChallenge
        ? {
            code_challenge: tx.codeChallenge,
            code_challenge_method: tx.codeChallengeMethod as any,
          }
        : {}),
    });

    return { authorizationUrl, browserNonce: tx.browserNonce };
  }

  /**
   * Exchanges the code Google returned for tokens and stores the connection.
   *
   * When backed by `OAuthTransactionService` (all runtime paths), requires an
   * expiring, single-use transaction bound to the initiating browser cookie,
   * user, and project BEFORE exchanging the code or storing tokens.
   */
  async completeAuthorization(input: { code: string; state: string; browserNonce?: string }) {
    let projectId: string;
    let organizationId: string;
    let providerId: GoogleProviderId;
    let returnTo: string | undefined;
    let pkceVerifier: string | null = null;
    let actorUserId: string | null = null;

    if (this.oauthTransactions) {
      const tx = await this.oauthTransactions.consumeTransaction({
        state: input.state,
        browserNonce: input.browserNonce,
        provider: GOOGLE_INTEGRATION_TX_PROVIDER,
      });
      if (!tx.projectId || !tx.organizationId || !tx.purpose) {
        throw new BadRequestException('OAuth transaction is missing project binding.');
      }
      projectId = tx.projectId;
      organizationId = tx.organizationId;
      providerId = tx.purpose as GoogleProviderId;
      returnTo = tx.returnTo ?? undefined;
      pkceVerifier = tx.pkceVerifier;
      actorUserId = tx.userId;
    } else {
      const state = decodeState(input.state);
      projectId = state.projectId;
      organizationId = state.organizationId;
      providerId = state.provider as GoogleProviderId;
      returnTo = state.returnTo;
    }

    const provider = GOOGLE_PROVIDERS[providerId];
    if (!provider) throw new BadRequestException('OAuth state names a provider that does not exist.');

    // Confirms the project still exists and still belongs to the organization
    // the transaction bound. A stale link from a deleted project must not write.
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('The project this authorization was started from no longer exists.');

    // Re-check that the initiating user still has manager privileges on the workspace.
    if (actorUserId && this.prisma.organizationMember?.findUnique) {
      const membership = await this.prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: actorUserId, organizationId } },
        select: { role: true },
      });
      if (!membership || !['OWNER', 'ADMIN'].includes(String(membership.role))) {
        throw new ForbiddenException('The user who initiated this Google connection no longer has permission to attach integrations.');
      }
    }

    const oauthClient = this.client();
    const { tokens } = pkceVerifier
      ? await oauthClient.getToken({ code: input.code, codeVerifier: pkceVerifier })
      : await oauthClient.getToken(input.code);
    if (!tokens.access_token) {
      throw new BadRequestException('Google did not return an access token.');
    }
    const accountEmail = await this.accountEmail(oauthClient, tokens.access_token);

    // Google returns a refresh token only when it feels like it. Reusing the
    // stored one keeps a reconnect from silently downgrading a durable
    // connection to a one-hour one.
    const existing = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: providerId } },
    });
    const refreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : (existing?.refreshToken ?? null);

    const granted = (tokens.scope ?? '').split(' ').filter(Boolean);
    // A customer can untick a scope on the consent screen. Better to find out
    // here than when the first sync returns 403.
    const missingScopes = provider.scopes.filter((scope) => granted.length > 0 && !granted.includes(scope));

    const integration = await this.prisma.integration.upsert({
      where: { projectId_provider: { projectId, provider: providerId } },
      update: {
        accessToken: encryptToken(tokens.access_token),
        refreshToken,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        grantedScopes: granted,
        googleAccountEmail: accountEmail ?? existing?.googleAccountEmail ?? null,
        status: missingScopes.length > 0 ? 'ERROR' : 'NEEDS_SELECTION',
        statusMessage:
          missingScopes.length > 0
            ? `Google did not grant the access needed to read your ${provider.label} data. Reconnect and accept all requested permissions.`
            : null,
      },
      create: {
        projectId,
        provider: providerId,
        accessToken: encryptToken(tokens.access_token),
        refreshToken,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        grantedScopes: granted,
        googleAccountEmail: accountEmail,
        status: missingScopes.length > 0 ? 'ERROR' : 'NEEDS_SELECTION',
        statusMessage:
          missingScopes.length > 0
            ? `Google did not grant the access needed to read your ${provider.label} data. Reconnect and accept all requested permissions.`
            : null,
      },
    });

    await this.record(integration.id, projectId, 'CONNECTED', `${provider.label} authorized.`);

    return { integration, provider, returnTo, missingScopes };
  }

  /**
   * The Google account behind a fresh authorization, for display only.
   *
   * Best effort: an account that declined the email scope, or a tokeninfo
   * hiccup, must not fail the connection — the email is a label, not a
   * credential, and the card falls back to saying it was not recorded.
   */
  private async accountEmail(client: OAuth2Client, accessToken: string): Promise<string | null> {
    try {
      const info = await client.getTokenInfo(accessToken);
      return info.email ?? null;
    } catch {
      return null;
    }
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
            // A refresh only proves the authorization still works. It says
            // nothing about whether a property has been chosen, so it must not
            // promote the connection to CONNECTED.
            //
            // Setting it unconditionally made the connect flow a dead end, and
            // in the least obvious way possible: opening the property picker
            // calls listProperties, which builds this client, which refreshes
            // the token, which flipped NEEDS_SELECTION to CONNECTED. On the
            // next load the picker was gone — the page thought the job was
            // done — and every sync then failed with "no property selected",
            // with no way back to the screen that sets one. Merely looking at
            // the picker destroyed the state that shows the picker.
            ...(integration.selectedResourceId ? { status: 'CONNECTED', statusMessage: null } : {}),
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

  /**
   * Marks a connection as broken for a reason reconnecting will not fix.
   *
   * The case this exists for is Business Profile: Google gates those APIs
   * behind an application review granted per Cloud project, so a perfectly
   * valid grant still answers 403 until that review lands. Routing it through
   * markNeedsReauth would tell the customer to reconnect, which does nothing
   * and can be repeated forever; routing it through a thrown error would leave
   * the dashboard looking merely empty. ERROR with the actual reason is the
   * only state that says what is true.
   *
   * The message is written verbatim to `statusMessage`, so callers must pass
   * something a customer can act on and never a raw payload.
   */
  async markError(projectId: string, providerId: GoogleProviderId, message: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: providerId } },
      select: { id: true, status: true },
    });
    if (!integration) return;
    // A connection the customer has already been told to reconnect stays that
    // way: a 403 arriving afterwards is a consequence, not a new diagnosis.
    if (integration.status === 'NEEDS_REAUTH') return;

    await this.prisma.integration.update({
      where: { id: integration.id },
      data: { status: 'ERROR', statusMessage: message },
    });
    await this.record(integration.id, projectId, 'SYNC_FAILED', message);
  }

  /**
   * Clears an ERROR once the source can be read again.
   *
   * Without this, a project whose Google approval finally came through would
   * keep telling its owner that access is still pending. Only ERROR is
   * cleared — NEEDS_REAUTH and NEEDS_SELECTION are states a person resolves,
   * and a successful read does not resolve either. The promotion to CONNECTED
   * is conditional on a selected resource for the same reason the refresh
   * handler is: CONNECTED with nothing selected is the dead end where the
   * picker stops rendering.
   */
  async clearError(projectId: string, providerId: GoogleProviderId) {
    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: providerId } },
      select: { id: true, status: true, selectedResourceId: true },
    });
    if (!integration || integration.status !== 'ERROR' || !integration.selectedResourceId) return;

    await this.prisma.integration.update({
      where: { id: integration.id },
      data: { status: 'CONNECTED', statusMessage: null },
    });
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
    // Cached GA4 figures belong to the property they were read from; a
    // different choice must not keep showing the old property's numbers.
    if (providerId === 'analytics') {
      await this.prisma.ga4ReportSnapshot.deleteMany({ where: { projectId, propertyId: { not: resource.id } } });
    }
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

    // Disconnecting takes the cached GA4 report with it, not only the tokens.
    if (providerId === 'analytics') {
      await this.prisma.ga4ReportSnapshot.deleteMany({ where: { projectId } });
    }
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
      // Environment-variable names are operator diagnostics, not customer
      // guidance. Keep the exact list in server logs and expose only whether
      // this deployment is ready.
      configuration: { configured: this.configuration().configured },
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
