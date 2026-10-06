import * as jwt from 'jsonwebtoken';
import { CrawlerGateway } from './crawler.gateway';

const SECRET = 'test-secret-value-for-gateway-spec-0123456789';

jest.mock('../../config/secrets', () => ({ jwtSecret: () => 'test-secret-value-for-gateway-spec-0123456789' }));

function fakeSocket(auth: any, cookie?: string) {
  return {
    id: 's1',
    data: {} as any,
    handshake: { auth, headers: cookie ? { cookie } : {} },
    disconnect: jest.fn(),
    join: jest.fn(),
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

  it('accepts a valid token from the HttpOnly cookie', () => {
    const s = fakeSocket({}, `a=b; access_token=${jwt.sign({ sub: 'u1' }, SECRET, { expiresIn: '5m' })}`);
    gateway.handleConnection(s);
    expect(s.disconnect).not.toHaveBeenCalled();
    expect(s.data.userId).toBe('u1');
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
});
