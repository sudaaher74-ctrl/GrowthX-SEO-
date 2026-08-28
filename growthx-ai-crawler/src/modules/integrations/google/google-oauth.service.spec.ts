import { GoogleOAuthService } from './google-oauth.service';
import { encodeState } from './oauth-state';
import { encryptToken } from './token-crypto';

/**
 * This service holds the keys to every customer's Google data, so the tests
 * that matter here are the ones about what it refuses: an unverifiable state,
 * a scope the customer declined, a token it cannot read.
 */
describe('GoogleOAuthService', () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.GOOGLE_REDIRECT_URI = 'https://api.example.com/api/integrations/google/callback';
    process.env.INTEGRATION_TOKEN_KEY = 'C1PS0y3rGHb0mAtwGDbTeoiSMkR8CQrRD1z0jFYqQ7Y=';
    process.env.INTEGRATION_STATE_SECRET = 'test-state-secret';
  });
  afterAll(() => {
    process.env = env;
  });

  const build = (overrides: any = {}) => {
    const prisma = {
      project: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
      integration: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(async ({ create, update }: any) => ({ id: 'i1', ...create, ...update })),
        update: jest.fn(async ({ data }: any) => ({ id: 'i1', ...data })),
        delete: jest.fn().mockResolvedValue({}),
      },
      integrationAuditEvent: { create: jest.fn().mockResolvedValue({}) },
      ...overrides,
    };
    return { prisma, service: new GoogleOAuthService(prisma as any) };
  };

  describe('configuration', () => {
    it('reports what is missing rather than failing at Google', () => {
      // A Connect button that leads to a Google error page the customer cannot
      // act on is worse than one that is not shown.
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.INTEGRATION_TOKEN_KEY;

      const { service } = build();

      expect(service.configuration()).toEqual({
        configured: false,
        missing: ['GOOGLE_CLIENT_ID', 'INTEGRATION_TOKEN_KEY'],
      });
    });

    it('will not build an authorization URL when unconfigured', () => {
      delete process.env.GOOGLE_CLIENT_SECRET;
      const { service } = build();

      expect(() =>
        service.authorizationUrl({ provider: 'search_console', projectId: 'p1', organizationId: 'o1' }),
      ).toThrow(/not configured/i);
    });
  });

  describe('authorizationUrl', () => {
    it('asks only for the scope the chosen service needs', () => {
      // Connecting Search Console must not also ask for Business Profile.
      const { service } = build();

      const url = service.authorizationUrl({ provider: 'search_console', projectId: 'p1', organizationId: 'o1' });

      expect(url).toContain('webmasters.readonly');
      expect(url).not.toContain('business.manage');
      expect(url).not.toContain('analytics.readonly');
    });

    it('asks for offline access and forces consent', () => {
      // Without prompt=consent Google returns a refresh token only on the very
      // first authorization for an account, so a reconnect silently leaves a
      // connection that dies in an hour.
      const { service } = build();

      const url = service.authorizationUrl({ provider: 'analytics', projectId: 'p1', organizationId: 'o1' });

      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
    });

    it('carries a signed state, not a readable one', () => {
      const { service } = build();

      const url = service.authorizationUrl({ provider: 'search_console', projectId: 'p1', organizationId: 'o1' });
      const state = decodeURIComponent(new URL(url).searchParams.get('state')!);

      expect(state.split('.')).toHaveLength(2);
      expect(state).not.toContain('p1');
    });
  });

  describe('completeAuthorization', () => {
    const withToken = (tokens: any) => {
      const { prisma, service } = build();
      (service as any).client = () => ({ getToken: jest.fn().mockResolvedValue({ tokens }) });
      return { prisma, service };
    };

    const state = () => encodeState({ projectId: 'p1', organizationId: 'o1', provider: 'search_console' });

    it('refuses a state it did not sign', async () => {
      // The attack this exists for: name someone else's project in the state
      // and have your Google account attached to their workspace.
      const { service } = withToken({ access_token: 'a' });
      const forged = Buffer.from(JSON.stringify({ projectId: 'victim', organizationId: 'o', provider: 'search_console' })).toString('base64url');

      await expect(service.completeAuthorization({ code: 'c', state: `${forged}.fake` })).rejects.toThrow(
        /did not originate here/,
      );
    });

    it('stores the tokens encrypted, never in the clear', async () => {
      const { prisma, service } = withToken({
        access_token: 'ya29.plain-access',
        refresh_token: '1//plain-refresh',
        scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      });

      await service.completeAuthorization({ code: 'c', state: state() });

      const written = JSON.stringify(prisma.integration.upsert.mock.calls[0][0]);
      expect(written).not.toContain('ya29.plain-access');
      expect(written).not.toContain('1//plain-refresh');
      expect(written).toContain('v1.');
    });

    it('lands in NEEDS_SELECTION, because a property has not been chosen yet', async () => {
      // Authorized but unusable is a real state and the UI has to show it.
      const { prisma, service } = withToken({
        access_token: 'a',
        scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      });

      await service.completeAuthorization({ code: 'c', state: state() });

      expect(prisma.integration.upsert.mock.calls[0][0].create.status).toBe('NEEDS_SELECTION');
    });

    it('catches a scope the customer unticked on the consent screen', async () => {
      // Otherwise the first sync fails with a 403 and the customer is told
      // nothing about why.
      const { prisma, service } = withToken({ access_token: 'a', scope: 'https://www.googleapis.com/auth/userinfo.email' });

      const result = await service.completeAuthorization({ code: 'c', state: state() });

      expect(result.missingScopes).toContain('https://www.googleapis.com/auth/webmasters.readonly');
      expect(prisma.integration.upsert.mock.calls[0][0].create.status).toBe('ERROR');
    });

    it('keeps the existing refresh token when Google does not send a new one', async () => {
      // Google returns one only sometimes. Overwriting with null downgrades a
      // durable connection to one that expires in an hour.
      const stored = encryptToken('1//the-original-refresh');
      const { prisma, service } = withToken({
        access_token: 'a',
        scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      });
      prisma.integration.findUnique.mockResolvedValue({ id: 'i1', refreshToken: stored });

      await service.completeAuthorization({ code: 'c', state: state() });

      expect(prisma.integration.upsert.mock.calls[0][0].update.refreshToken).toBe(stored);
    });

    it('refuses to write against a project that no longer exists', async () => {
      const { prisma, service } = withToken({ access_token: 'a' });
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(service.completeAuthorization({ code: 'c', state: state() })).rejects.toThrow(/no longer exists/);
    });

    it('records the connection in the audit trail', async () => {
      const { prisma, service } = withToken({
        access_token: 'a',
        scope: 'https://www.googleapis.com/auth/webmasters.readonly',
      });

      await service.completeAuthorization({ code: 'c', state: state() });

      const event = prisma.integrationAuditEvent.create.mock.calls[0][0].data;
      expect(event.event).toBe('CONNECTED');
      // An audit row is readable by anyone with project access.
      expect(JSON.stringify(event)).not.toContain('ya29');
    });
  });

  describe('clientFor', () => {
    it('turns an unreadable stored token into a reconnect, not a crash', async () => {
      // A token written before encryption existed, or one the current key
      // cannot open. Neither is a bug to retry.
      const { prisma, service } = build();
      prisma.integration.findUnique.mockResolvedValue({
        id: 'i1',
        status: 'CONNECTED',
        accessToken: 'legacy-plaintext-token',
        refreshToken: null,
      });

      await expect(service.clientFor('p1', 'search_console')).rejects.toThrow(/reconnected/i);
      expect(prisma.integration.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'NEEDS_REAUTH' }) }),
      );
    });

    it('refuses a connection already known to need reauthorization', async () => {
      const { prisma, service } = build();
      prisma.integration.findUnique.mockResolvedValue({ id: 'i1', status: 'NEEDS_REAUTH', accessToken: 'x' });

      await expect(service.clientFor('p1', 'search_console')).rejects.toThrow(/reconnected/i);
    });

    it('says the service is not connected rather than returning nothing', async () => {
      const { service } = build();
      await expect(service.clientFor('p1', 'analytics')).rejects.toThrow(/not connected/i);
    });
  });

  describe('statusFor', () => {
    it('reports every provider, including the ones not connected', async () => {
      // A dashboard that omits unconnected sources cannot offer a Connect
      // button for them, and one that renders them as zeroes looks broken.
      const { service } = build();

      const status = await service.statusFor('p1');

      expect(status.providers.map((p) => p.id).sort()).toEqual(['analytics', 'business_profile', 'search_console']);
      expect(status.providers.every((p) => p.status === 'NOT_CONNECTED')).toBe(true);
    });

    it('flags the provider Google gates behind its own approval', async () => {
      // Business Profile API access is granted per Cloud project on request.
      // A Connect button that can only 403 is worse than an explanation.
      const { service } = build();

      const status = await service.statusFor('p1');

      expect(status.providers.find((p) => p.id === 'business_profile')!.requiresGoogleApproval).toBe(true);
      expect(status.providers.find((p) => p.id === 'search_console')!.requiresGoogleApproval).toBe(false);
    });

    it('never returns a token in the status payload', async () => {
      const { prisma, service } = build();
      prisma.integration.findMany.mockResolvedValue([
        {
          provider: 'search_console',
          status: 'CONNECTED',
          accessToken: encryptToken('ya29.secret'),
          refreshToken: encryptToken('1//secret'),
          selectedResourceId: 'sc-domain:example.com',
          selectedResourceName: 'example.com',
        },
      ]);

      const status = await service.statusFor('p1');

      expect(JSON.stringify(status)).not.toContain('accessToken');
      expect(JSON.stringify(status)).not.toContain('v1.');
    });
  });

  describe('disconnect', () => {
    it('revokes at Google as well as deleting locally', async () => {
      // Deleting our row alone leaves the customer's Google account still
      // granting this application access, with nothing to explain why.
      const { prisma, service } = build();
      const revokeToken = jest.fn().mockResolvedValue({});
      prisma.integration.findUnique.mockResolvedValue({ id: 'i1', refreshToken: encryptToken('1//r') });
      (service as any).client = () => ({ revokeToken });

      const result = await service.disconnect('p1', 'search_console', 'u1');

      expect(revokeToken).toHaveBeenCalledWith('1//r');
      expect(prisma.integration.delete).toHaveBeenCalled();
      expect(result).toEqual({ disconnected: true, revoked: true });
    });

    it('still disconnects when Google cannot be reached', async () => {
      // The customer asked to disconnect. Keeping their tokens because a
      // third party was unreachable is the wrong way to fail.
      const { prisma, service } = build();
      prisma.integration.findUnique.mockResolvedValue({ id: 'i1', refreshToken: encryptToken('1//r') });
      (service as any).client = () => ({ revokeToken: jest.fn().mockRejectedValue(new Error('network')) });

      const result = await service.disconnect('p1', 'search_console');

      expect(prisma.integration.delete).toHaveBeenCalled();
      expect(result).toEqual({ disconnected: true, revoked: false });
    });
  });
});

/**
 * Found in production, and the least obvious dead end available: opening the
 * property picker calls listProperties, which builds an auth client, which
 * refreshes the token, which flipped NEEDS_SELECTION to CONNECTED. The picker
 * then vanished, every sync failed with "no property selected", and there was
 * no route back to the screen that sets one. Looking at the picker destroyed
 * the picker.
 */
describe('GoogleOAuthService — a token refresh must not promote the connection', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_REDIRECT_URI = 'https://api.example.com/api/integrations/google/callback';
    process.env.INTEGRATION_TOKEN_KEY = 'C1PS0y3rGHb0mAtwGDbTeoiSMkR8CQrRD1z0jFYqQ7Y=';
  });
  afterAll(() => {
    process.env = env;
  });

  const refreshWith = async (row: any) => {
    const prisma = {
      integration: { findUnique: jest.fn().mockResolvedValue(row), update: jest.fn().mockResolvedValue({}) },
      integrationAuditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new GoogleOAuthService(prisma as any);
    const client = await service.clientFor('p1', 'search_console');
    // What google-auth-library emits after it renews an access token.
    client.emit('tokens', { access_token: 'ya29.fresh', expiry_date: Date.now() + 3600_000 });
    await new Promise((r) => setImmediate(r));
    return prisma.integration.update.mock.calls[0]?.[0]?.data ?? {};
  };

  it('leaves NEEDS_SELECTION alone when no property has been chosen', async () => {
    const written = await refreshWith({
      id: 'i1',
      status: 'NEEDS_SELECTION',
      selectedResourceId: null,
      accessToken: encryptToken('ya29.old'),
      refreshToken: encryptToken('1//r'),
    });

    expect(written).not.toHaveProperty('status');
    // The token itself is still persisted; only the promotion is withheld.
    expect(written).toHaveProperty('accessToken');
  });

  it('does confirm the connection once a property is selected', async () => {
    // A NEEDS_REAUTH row cannot reach here — clientFor refuses it before a
    // client is ever built, because a dead grant cannot refresh itself. The
    // case that matters is a working connection whose access token expired:
    // the refresh confirms it, and clears any transient message on it.
    const written = await refreshWith({
      id: 'i1',
      status: 'CONNECTED',
      statusMessage: 'a transient failure recorded earlier',
      selectedResourceId: 'sc-domain:example.com',
      accessToken: encryptToken('ya29.old'),
      refreshToken: encryptToken('1//r'),
    });

    expect(written.status).toBe('CONNECTED');
    expect(written.statusMessage).toBeNull();
  });
});
