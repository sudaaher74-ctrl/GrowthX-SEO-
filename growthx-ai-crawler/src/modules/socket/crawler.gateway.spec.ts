import * as jwt from 'jsonwebtoken';
import { CrawlerGateway, REALTIME_PUBSUB_CHANNEL } from './crawler.gateway';

const SECRET = 'test-secret-value-for-gateway-spec-0123456789';

jest.mock('../../config/secrets', () => ({ jwtSecret: () => 'test-secret-value-for-gateway-spec-0123456789' }));

function fakeSocket(auth: any, cookie?: string, extraHeaders: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extraHeaders };
  if (cookie) headers.cookie = cookie;
  return {
    id: `s-${Math.random().toString(36).slice(2, 8)}`,
    data: {} as any,
    handshake: { auth, headers },
    disconnect: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
  } as any;
}

describe('CrawlerGateway', () => {
  const prisma: any = {
    organizationMember: { findUnique: jest.fn() },
    crawlJob: { findUnique: jest.fn() },
    project: { findUnique: jest.fn() },
    voiceSession: { findUnique: jest.fn() },
  };
  let gateway: CrawlerGateway;

  beforeEach(() => {
    jest.resetAllMocks();
    gateway = new CrawlerGateway(prisma);
  });

  afterEach(async () => {
    await gateway.onModuleDestroy();
  });

  it('disconnects a client with no token', () => {
    const s = fakeSocket({});
    gateway.handleConnection(s);
    expect(s.disconnect).toHaveBeenCalled();
  });

  it('disconnects a client presenting a refresh token', () => {
    const s = fakeSocket({ token: jwt.sign({ sub: 'u1', type: 'refresh' }, SECRET) });
    gateway.handleConnection(s);
    expect(s.disconnect).toHaveBeenCalled();
  });

  it('disconnects a forged token', () => {
    const s = fakeSocket({ token: jwt.sign({ sub: 'u1' }, 'another-secret') });
    gateway.handleConnection(s);
    expect(s.disconnect).toHaveBeenCalled();
  });

  it('accepts a valid token from the HttpOnly cookie when Origin is allowed', () => {
    const s = fakeSocket(
      {},
      `a=b; access_token=${jwt.sign({ sub: 'u1' }, SECRET, { expiresIn: '5m' })}`,
      { origin: 'http://localhost:3001' },
    );
    gateway.handleConnection(s);
    expect(s.disconnect).not.toHaveBeenCalled();
    expect(s.data.userId).toBe('u1');
  });

  it('rejects a cross-site WebSocket handshake carrying an HttpOnly session cookie (Medium #20)', () => {
    const s = fakeSocket(
      {},
      `access_token=${jwt.sign({ sub: 'u1' }, SECRET, { expiresIn: '5m' })}`,
      { origin: 'https://evil.attacker.example' },
    );
    gateway.handleConnection(s);
    expect(s.disconnect).toHaveBeenCalledWith(true);
    expect(s.data.userId).toBeUndefined();
  });

  it('rejects a cookie-authenticated WebSocket handshake when Origin header is missing (Medium #20)', () => {
    const s = fakeSocket(
      {},
      `access_token=${jwt.sign({ sub: 'u1' }, SECRET, { expiresIn: '5m' })}`,
    );
    gateway.handleConnection(s);
    expect(s.disconnect).toHaveBeenCalledWith(true);
    expect(s.data.userId).toBeUndefined();
  });

  it('disconnects an already-connected socket automatically when its JWT expires (Medium #20)', () => {
    jest.useFakeTimers();
    try {
      const s = fakeSocket(
        {},
        `access_token=${jwt.sign({ sub: 'u1' }, SECRET, { expiresIn: 2 })}`,
        { origin: 'http://localhost:3001' },
      );
      gateway.handleConnection(s);
      expect(s.disconnect).not.toHaveBeenCalled();

      jest.advanceTimersByTime(2500);
      expect(s.disconnect).toHaveBeenCalledWith(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('evicts an already-subscribed socket from organization crawl and project rooms when membership is revoked (Medium #20)', async () => {
    const s = fakeSocket(
      {},
      `access_token=${jwt.sign({ sub: 'u1' }, SECRET, { expiresIn: '5m' })}`,
      { origin: 'http://localhost:3001' },
    );
    gateway.handleConnection(s);

    prisma.crawlJob.findUnique.mockResolvedValue({ website: { scope: 'own', project: { organizationId: 'orgA' } } });
    prisma.project.findUnique.mockResolvedValue({ organizationId: 'orgA' });
    prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm1' });

    expect(await gateway.subscribeCrawl(s, { jobId: 'job-12345678' })).toEqual({ ok: true });
    expect(await gateway.subscribeProject(s, { projectId: 'proj-12345678' })).toEqual({ ok: true });
    expect(s.join).toHaveBeenCalledWith('crawl:job-12345678');
    expect(s.join).toHaveBeenCalledWith('project:proj-12345678');

    // Member is removed from orgA — active subscriptions must be revoked immediately.
    gateway.revokeOrganizationAccess('u1', 'orgA');
    expect(s.leave).toHaveBeenCalledWith('crawl:job-12345678');
    expect(s.leave).toHaveBeenCalledWith('project:proj-12345678');
  });

  it('disconnects a socket whose token predates User.sessionsInvalidatedAt (Medium #20)', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    prisma.user = {
      findUnique: jest.fn().mockResolvedValue({
        sessionsInvalidatedAt: new Date((nowSec + 10) * 1000),
      }),
    };
    const s = fakeSocket(
      {},
      `access_token=${jwt.sign({ sub: 'u1', iat: nowSec }, SECRET, { expiresIn: '5m' })}`,
      { origin: 'http://localhost:3001' },
    );
    gateway.handleConnection(s);
    await new Promise((r) => setImmediate(r));
    expect(s.disconnect).toHaveBeenCalledWith(true);
    delete prisma.user;
  });

  it('refuses to join a crawl room for another organization', async () => {
    const s = fakeSocket({});
    s.data.userId = 'u1';
    prisma.crawlJob.findUnique.mockResolvedValue({ website: { scope: 'x', project: { organizationId: 'orgB' } } });
    prisma.organizationMember.findUnique.mockResolvedValue(null);
    const res = await gateway.subscribeCrawl(s, { jobId: 'job-12345678' });
    expect(res).toEqual({ ok: false });
    expect(s.join).not.toHaveBeenCalled();
  });

  it('joins a crawl room for a member of the owning organization', async () => {
    const s = fakeSocket({});
    s.data.userId = 'u1';
    prisma.crawlJob.findUnique.mockResolvedValue({ website: { scope: 'x', project: { organizationId: 'orgA' } } });
    prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm1' });
    const res = await gateway.subscribeCrawl(s, { jobId: 'job-12345678' });
    expect(res).toEqual({ ok: true });
    expect(s.join).toHaveBeenCalledWith('crawl:job-12345678');
  });

  it('resolves a competitor crawl to the owning project organization', async () => {
    const s = fakeSocket({});
    s.data.userId = 'u1';
    prisma.crawlJob.findUnique.mockResolvedValue({ website: { scope: 'competitor:proj-1', project: null } });
    prisma.project.findUnique.mockResolvedValue({ organizationId: 'orgA' });
    prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm1' });
    expect(await gateway.subscribeCrawl(s, { jobId: 'job-12345678' })).toEqual({ ok: true });
  });

  it('rejects malformed ids without touching the database', async () => {
    const s = fakeSocket({});
    s.data.userId = 'u1';
    expect(await gateway.subscribeCrawl(s, { jobId: '../../etc' })).toEqual({ ok: false });
    expect(prisma.crawlJob.findUnique).not.toHaveBeenCalled();
  });

  it("refuses another user's voice session", async () => {
    const s = fakeSocket({});
    s.data.userId = 'u1';
    prisma.voiceSession.findUnique.mockResolvedValue({ userId: 'u2' });
    expect(await gateway.subscribeAiva(s, { sessionId: 'sess-12345678' })).toEqual({ ok: false });
  });

  it('refuses a subscription after the token has expired', async () => {
    const s = fakeSocket({});
    s.data.userId = 'u1';
    s.data.tokenExp = Math.floor(Date.now() / 1000) - 10;
    expect(await gateway.subscribeCrawl(s, { jobId: 'job-12345678' })).toEqual({ ok: false });
  });

  it('emits only to the job room, never to every client', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    gateway.server = { to, emit: jest.fn() } as any;
    gateway.broadcastProgress('job-1', { pagesCrawled: 1 });
    expect(to).toHaveBeenCalledWith('crawl:job-1');
    expect((gateway.server as any).emit).not.toHaveBeenCalled();
  });

  it('authorizes project room subscriptions and emits findings updates only to that project room', async () => {
    const s = fakeSocket({});
    s.data.userId = 'u1';
    prisma.project.findUnique.mockResolvedValue({ organizationId: 'orgA' });
    prisma.organizationMember.findUnique.mockResolvedValueOnce(null);
    expect(await gateway.subscribeProject(s, { projectId: 'proj-12345678' })).toEqual({ ok: false });

    prisma.organizationMember.findUnique.mockResolvedValueOnce({ id: 'm1' });
    expect(await gateway.subscribeProject(s, { projectId: 'proj-12345678' })).toEqual({ ok: true });
    expect(s.join).toHaveBeenCalledWith('project:proj-12345678');

    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    gateway.server = { to, emit: jest.fn() } as any;
    gateway.broadcastFindingsUpdated('proj-12345678', {
      sources: ['WEBSITE'],
      created: 1,
      updated: 0,
      resolved: 2,
      updatedAt: '2026-11-19T00:00:00.000Z',
    });
    expect(to).toHaveBeenCalledWith('project:proj-12345678');
    expect(emit).toHaveBeenCalledWith(
      'findings.updated.proj-12345678',
      expect.objectContaining({ sources: ['WEBSITE'], created: 1, resolved: 2 }),
    );
  });

  it('bridges worker broadcasts over Redis Pub/Sub to API WebSocket rooms', async () => {
    let onMessage: ((channel: string, raw: string) => void) | undefined;
    const sub = {
      on: jest.fn((event: string, cb: any) => {
        if (event === 'message') onMessage = cb;
      }),
      subscribe: jest.fn().mockResolvedValue(1),
      unsubscribe: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    const redis = {
      publish: jest.fn().mockImplementation((channel: string, raw: string) => {
        onMessage?.(channel, raw);
        return Promise.resolve(1);
      }),
      duplicate: jest.fn().mockReturnValue(sub),
    };
    const queue = {
      ready: Promise.resolve(),
      getRedisClient: jest.fn().mockReturnValue(redis),
    };

    const bridged = new CrawlerGateway(prisma, queue as any);
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    bridged.server = { to, emit: jest.fn() } as any;

    bridged.onModuleInit();
    await new Promise((r) => setImmediate(r));

    expect(sub.subscribe).toHaveBeenCalledWith(REALTIME_PUBSUB_CHANNEL);

    bridged.broadcastFindingsUpdated('proj-99999999', {
      sources: ['WEBSITE'],
      created: 2,
      updated: 1,
      resolved: 0,
      updatedAt: '2026-11-19T00:00:00.000Z',
    });

    expect(redis.publish).toHaveBeenCalledWith(
      REALTIME_PUBSUB_CHANNEL,
      expect.stringContaining('proj-99999999'),
    );
    expect(to).toHaveBeenCalledWith('project:proj-99999999');
    expect(emit).toHaveBeenCalledWith(
      'findings.updated.proj-99999999',
      expect.objectContaining({ created: 2, updated: 1 }),
    );

    await bridged.onModuleDestroy();
    expect(sub.unsubscribe).toHaveBeenCalledWith(REALTIME_PUBSUB_CHANNEL);
    expect(sub.quit).toHaveBeenCalled();
  });
});
