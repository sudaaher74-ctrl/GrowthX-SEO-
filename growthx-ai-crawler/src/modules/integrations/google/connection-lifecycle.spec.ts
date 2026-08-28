import { EventEmitter } from 'events';
import { GoogleOAuthService } from './google-oauth.service';
import { encodeState } from './oauth-state';

/**
 * The connect flow walked end to end, one operation after another.
 *
 * Every unit in this flow was tested and passed, and the flow itself was
 * unusable. Four bugs reached production, and each lived in the join between
 * two operations rather than inside either:
 *
 *  - authorize succeeded and left NEEDS_SELECTION, and no screen read that
 *    state, so the customer authorized three times and saw the first page
 *    every time;
 *  - listing properties refreshed the token, and the refresh handler set
 *    CONNECTED, so opening the picker destroyed the picker;
 *  - an empty property list said "none found" for two opposite causes;
 *  - the crawler stored images as pages, which nothing counting pages noticed.
 *
 * Testing each method in isolation cannot find any of those. This walks the
 * sequence and asserts the invariant that the whole flow depends on, after
 * every step: a connection is never CONNECTED without a property, because
 * that combination is the dead end — the picker stops rendering and there is
 * no route back to it.
 *
 * The database enforces the same rule with a CHECK constraint. This is the
 * faster feedback; that is the one that cannot be bypassed.
 */
describe('Google connection lifecycle', () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'id';
    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    process.env.GOOGLE_REDIRECT_URI = 'https://api.example.com/api/integrations/google/callback';
    process.env.INTEGRATION_TOKEN_KEY = 'C1PS0y3rGHb0mAtwGDbTeoiSMkR8CQrRD1z0jFYqQ7Y=';
    process.env.INTEGRATION_STATE_SECRET = 'state-secret';
  });
  afterAll(() => {
    process.env = env;
  });

  /**
   * A stand-in for the Integration table that records every attempt to reach
   * the forbidden state.
   *
   * Recording rather than throwing, which the first version of this did and
   * which made the suite useless: the refresh handler persists inside a
   * .catch(), so a thrown invariant was swallowed and logged, the bad write
   * never landed, the state stayed correct, and the test passed with the bug
   * present. Verified by reintroducing it. A regression test that cannot fail
   * on the regression is worse than none — it is counted as cover.
   *
   * The write is allowed through and the attempt is remembered, so the test
   * can assert that nothing even tried.
   */
  function fakeDatabase() {
    let row: any = null;
    const violations: string[] = [];

    const record = (candidate: any, operation: string) => {
      if (candidate?.status === 'CONNECTED' && !candidate.selectedResourceId) {
        violations.push(
          `${operation} set status CONNECTED with no selectedResourceId — the dead end: the property ` +
            'picker only renders for NEEDS_SELECTION, so nothing can set a property from here.',
        );
      }
      return candidate;
    };

    return {
      state: () => row,
      violations: () => violations,
      project: { findFirst: jest.fn().mockResolvedValue({ id: 'p1' }) },
      integration: {
        findUnique: jest.fn(async () => row),
        findMany: jest.fn(async () => (row ? [row] : [])),
        upsert: jest.fn(async ({ create, update }: any) => {
          row = record(row ? { ...row, ...update } : { id: 'i1', ...create }, 'upsert');
          return row;
        }),
        update: jest.fn(async ({ data }: any) => {
          row = record({ ...row, ...data }, 'update');
          return row;
        }),
        delete: jest.fn(async () => {
          row = null;
          return {};
        }),
      },
      integrationAuditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
  }

  const build = () => {
    const prisma = fakeDatabase();
    const service = new GoogleOAuthService(prisma as any);

    // Stands in for google-auth-library's OAuth2Client. An EventEmitter,
    // because the whole point of this suite is the 'tokens' event it emits
    // after a refresh — the step that used to finish the flow by accident.
    (service as any).client = () => {
      const client: any = new EventEmitter();
      client.setCredentials = jest.fn();
      client.getToken = jest.fn().mockResolvedValue({
        tokens: {
          access_token: 'ya29.first',
          refresh_token: '1//refresh',
          scope: 'https://www.googleapis.com/auth/webmasters.readonly',
          expiry_date: Date.now() + 3600_000,
        },
      });
      client.revokeToken = jest.fn().mockResolvedValue({});
      return client;
    };
    return { prisma, service };
  };

  const state = () => encodeState({ projectId: 'p1', organizationId: 'o1', provider: 'search_console' });

  it('walks authorize → list → refresh → select → connected without ever reaching the dead end', async () => {
    const { prisma, service } = build();

    // 1. The customer comes back from Google.
    await service.completeAuthorization({ code: 'code', state: state() });
    expect(prisma.state().status).toBe('NEEDS_SELECTION');

    // 2. The picker opens, which builds a client and refreshes the token. This
    //    is the step that used to silently finish the flow.
    const client = await service.clientFor('p1', 'search_console');
    client.emit('tokens', { access_token: 'ya29.second', expiry_date: Date.now() + 3600_000 });
    await new Promise((r) => setImmediate(r));

    expect(prisma.state().status).toBe('NEEDS_SELECTION');
    // The refreshed token is still saved — only the promotion is withheld.
    expect(prisma.state().accessToken).not.toBe('ya29.second');
    expect(prisma.state().accessToken).toContain('v1.');

    // 3. The customer picks a property. Only now is the connection usable.
    await service.selectResource('p1', 'search_console', {
      id: 'sc-domain:aivaenterprises.com',
      name: 'aivaenterprises.com',
    });
    expect(prisma.state().status).toBe('CONNECTED');
    expect(prisma.state().selectedResourceId).toBe('sc-domain:aivaenterprises.com');

    // 4. A later refresh on a complete connection confirms it.
    const client2 = await service.clientFor('p1', 'search_console');
    client2.emit('tokens', { access_token: 'ya29.third', expiry_date: Date.now() + 3600_000 });
    await new Promise((r) => setImmediate(r));
    expect(prisma.state().status).toBe('CONNECTED');

    // The assertion that actually catches the regression: no write anywhere in
    // that sequence so much as attempted the forbidden combination.
    expect(prisma.violations()).toEqual([]);
  });

  it('reports a state the UI can act on at every step', async () => {
    // Each status has to correspond to a screen. A status nothing renders is
    // how the customer ends up looking at the wrong page with no way forward.
    const { service } = build();
    const statusNow = async () =>
      (await service.statusFor('p1')).providers.find((p) => p.id === 'search_console')!.status;

    expect(await statusNow()).toBe('NOT_CONNECTED'); // → Connect button
    await service.completeAuthorization({ code: 'c', state: state() });
    expect(await statusNow()).toBe('NEEDS_SELECTION'); // → property picker
    await service.selectResource('p1', 'search_console', { id: 'sc-domain:x.com', name: 'x.com' });
    expect(await statusNow()).toBe('CONNECTED'); // → the dashboard
  });

  it('returns to a selectable state after reconnecting', async () => {
    // Reconnecting has to land somewhere the customer can finish from. If it
    // came back CONNECTED against the old property, a customer switching
    // Google accounts would be reading the wrong site with no way to say so.
    const { prisma, service } = build();
    await service.completeAuthorization({ code: 'c', state: state() });
    await service.selectResource('p1', 'search_console', { id: 'sc-domain:old.com', name: 'old.com' });

    await service.completeAuthorization({ code: 'c2', state: state() });

    expect(prisma.state().status).toBe('NEEDS_SELECTION');
  });

  it('leaves nothing behind on disconnect', async () => {
    const { prisma, service } = build();
    await service.completeAuthorization({ code: 'c', state: state() });
    await service.selectResource('p1', 'search_console', { id: 'sc-domain:x.com', name: 'x.com' });

    await service.disconnect('p1', 'search_console', 'u1');

    expect(prisma.state()).toBeNull();
    // And the next authorize starts clean rather than inheriting the old one.
    await service.completeAuthorization({ code: 'c3', state: state() });
    expect(prisma.state().status).toBe('NEEDS_SELECTION');
    expect(prisma.state().selectedResourceId).toBeUndefined();
  });
});
