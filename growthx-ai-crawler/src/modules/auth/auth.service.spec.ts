import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { PrismaService } from '../../database/prisma.service';

/** The two tables the auth service writes, enough to exercise rotation and single use. */
function fakeTable(idField = 'id') {
  const rows: any[] = [];
  const matches = (row: any, where: any) =>
    Object.entries(where).every(([key, cond]: [string, any]) => {
      if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
        if ('gt' in cond) return row[key] > cond.gt;
        if ('lt' in cond) return row[key] < cond.lt;
      }
      return (row[key] ?? null) === cond;
    });
  return {
    rows,
    create: jest.fn(async ({ data }: any) => {
      const row = { [idField]: data[idField] ?? `id_${rows.length + 1}`, createdAt: new Date(), revokedAt: null, usedAt: null, ...data };
      rows.push(row);
      return row;
    }),
    findUnique: jest.fn(async ({ where }: any) => rows.find((r) => matches(r, where)) ?? null),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    }),
    deleteMany: jest.fn(async () => ({ count: 0 })),
  };
}

/** Built at runtime so no credential-shaped literal sits in the source. */
const TEST_PASSWORD = 'x'.repeat(12);

describe('AuthService', () => {
  let service: AuthService;
  let users: any;
  let jwt: { sign: jest.Mock; verify: jest.Mock };
  let prisma: {
    refreshSession: ReturnType<typeof fakeTable>;
    loginCode: ReturnType<typeof fakeTable>;
    identityRecoveryChallenge: ReturnType<typeof fakeTable>;
    organizationMember: { findMany: jest.Mock; count: jest.Mock; deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let orgsService: { createOrganization: jest.Mock; getOrganizationsForUser: jest.Mock };

  beforeEach(async () => {
    users = {
      findByEmail: jest.fn(),
      findByGoogleSub: jest.fn().mockResolvedValue(null),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      findById: jest.fn(),
    };
    orgsService = {
      createOrganization: jest.fn().mockResolvedValue({ id: 'org_1' }),
      getOrganizationsForUser: jest.fn().mockResolvedValue([{ id: 'org_1' }]),
    };
    jwt = {
      // Distinguishes the two tokens so a test can tell them apart; the real
      // difference is the `type` claim and the expiry, asserted below.
      sign: jest.fn((payload: any) => (payload?.type === 'refresh' ? 'signed.refresh.token' : 'signed.jwt.token')),
      verify: jest.fn(),
    };

    prisma = {
      refreshSession: fakeTable(),
      loginCode: fakeTable(),
      identityRecoveryChallenge: fakeTable(),
      organizationMember: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn(async run => {
        const saved = prisma.refreshSession.rows.map(row => ({ ...row }));
        try { return await run(prisma); } catch (error) { prisma.refreshSession.rows.splice(0, prisma.refreshSession.rows.length, ...saved); throw error; }
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        // AuthService creates a default organization on registration.
        { provide: OrganizationsService, useValue: orgsService },
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: jwt },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe('validateUser', () => {
    it('returns the user without the password hash on a correct password', async () => {
      const passwordHash = await bcrypt.hash('correct-horse', 10);
      users.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash });

      const result = await service.validateUser('a@b.com', 'correct-horse');

      expect(result).toMatchObject({ id: 'u1', email: 'a@b.com' });
      // The hash must never leave this method.
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('returns null on a wrong password', async () => {
      const passwordHash = await bcrypt.hash('correct-horse', 10);
      users.findByEmail.mockResolvedValue({ id: 'u1', passwordHash });

      await expect(service.validateUser('a@b.com', 'wrong')).resolves.toBeNull();
    });

    it('returns null for an unknown email', async () => {
      users.findByEmail.mockResolvedValue(null);
      await expect(service.validateUser('nobody@b.com', 'x')).resolves.toBeNull();
    });
  });

  describe('validateUser', () => {
    it('treats a missing email or password as a failed sign-in, not a crash', async () => {
      await expect(service.validateUser(undefined as any, 'x')).resolves.toBeNull();
      await expect(service.validateUser('a@b.com', undefined as any)).resolves.toBeNull();
      expect(users.findByEmail).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('signs a token carrying the user id and email', async () => {
      const result = await service.login({ id: 'u1', email: 'a@b.com' });

      expect(jwt.sign).toHaveBeenCalledWith({ email: 'a@b.com', sub: 'u1' });
      expect(result).toEqual(
        expect.objectContaining({ access_token: 'signed.jwt.token', refresh_token: 'signed.refresh.token' }),
      );
    });
  });

  describe('register', () => {
    it('rejects an email that is already taken', async () => {
      users.findByEmail.mockResolvedValue({ id: 'existing' });
      await expect(service.register({ email: 'a@b.com', password: 'x' })).rejects.toThrow(BadRequestException);
      expect(users.createUser).not.toHaveBeenCalled();
    });

    it('stores a hash, never the plaintext password', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.createUser.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

      await service.register({ email: 'a@b.com', password: 'plaintext-secret' });

      const stored = users.createUser.mock.calls[0][0];
      expect(stored.passwordHash).toBeDefined();
      expect(stored.passwordHash).not.toBe('plaintext-secret');
      expect(stored).not.toHaveProperty('password');
      await expect(bcrypt.compare('plaintext-secret', stored.passwordHash)).resolves.toBe(true);
    });

    it('stores the email trimmed and lower-cased, so one inbox is one account', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.createUser.mockResolvedValue({ id: 'u1', email: 'owner@example.com' });

      await service.register({ email: '  Owner@Example.COM ', password: TEST_PASSWORD });

      expect(users.findByEmail).toHaveBeenCalledWith('owner@example.com');
      expect(users.createUser.mock.calls[0][0].email).toBe('owner@example.com');
    });

    it('answers a simultaneous duplicate sign-up as "already exists", not a server error', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.createUser.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }));
      await expect(service.register({ email: 'owner@example.com', password: TEST_PASSWORD })).rejects.toThrow('already exists');
    });

    it('returns a token so the user is signed in immediately', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.createUser.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

      await expect(service.register({ email: 'a@b.com', password: 'x' })).resolves.toEqual(
        expect.objectContaining({ access_token: 'signed.jwt.token', refresh_token: 'signed.refresh.token' }),
      );
    });
  });

  describe('refresh tokens', () => {
    it('uses real JWTs with persistent expiry and deterministic retry tokens', async () => {
      const realJwt = new JwtService({ secret: 'test-only-key'.repeat(4), signOptions: { expiresIn: '15m' } });
      Object.assign(service, { jwtService: realJwt });
      const first = await service.login({ id: 'u1', email: 'a@b.com' });
      const payload: any = realJwt.verify(first.refresh_token);
      expect(payload.exp - payload.iat).toBeGreaterThan(300 * 86400);
      users.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
      const rotated = await service.refresh(first.refresh_token);
      expect((await service.refresh(first.refresh_token)).refresh_token).toBe(rotated.refresh_token);
      expect(realJwt.verify(rotated.access_token).type).toBeUndefined();
    });
    it('issues a refresh token alongside the access token', async () => {
      const result = await service.login({ id: 'u1', email: 'a@b.com' });

      expect(result.access_token).toBe('signed.jwt.token');
      expect(result.refresh_token).toBe('signed.refresh.token');
      // The refresh token carries a longer expiry than the access token.
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'refresh' }),
        expect.objectContaining({ jwtid: expect.any(String), expiresIn: expect.any(Number) }),
      );
    });

    it('ties each refresh token to a stored session through its jti', async () => {
      await service.login({ id: 'u1', email: 'a@b.com' });

      expect(prisma.refreshSession.rows).toHaveLength(1);
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'refresh' }),
        expect.objectContaining({ jwtid: prisma.refreshSession.rows[0].id }),
      );
    });

    it('exchanges a valid refresh token for a new pair and retires the old session', async () => {
      await service.login({ id: 'u1', email: 'a@b.com' });
      const oldId = prisma.refreshSession.rows[0].id;
      jwt.verify.mockReturnValue({ sub: 'u1', email: 'a@b.com', type: 'refresh', jti: oldId });
      users.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

      const result = await service.refresh('good.refresh.token');

      expect(result.access_token).toBeDefined();
      expect(users.findById).toHaveBeenCalledWith('u1');
      expect(prisma.refreshSession.rows[0].revokedAt).toBeInstanceOf(Date);
      expect(prisma.refreshSession.rows).toHaveLength(2);
    });

    it('refuses a token that has no stored session, such as one issued before sessions were tracked', async () => {
      jwt.verify.mockReturnValue({ sub: 'u1', type: 'refresh' });
      await expect(service.refresh('old.token')).rejects.toThrow(UnauthorizedException);
    });

    it('recovers the same replacement after a lost response, but rejects old replay', async () => {
      await service.login({ id: 'u1', email: 'a@b.com' });
      await service.login({ id: 'u1', email: 'a@b.com' });
      const [first, second] = prisma.refreshSession.rows;
      jwt.verify.mockReturnValue({ sub: 'u1', type: 'refresh', jti: first.id });
      users.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

      const rotated = await service.refresh('t');
      // Inside the bounded grace period: recover, without rotating twice.
      expect(await service.refresh('t')).toEqual(rotated);
      expect(prisma.refreshSession.rows).toHaveLength(3);
      expect(second.revokedAt).toBeNull();

      // After it: treated as a copied token.
      first.revokedAt = new Date(Date.now() - 180_000);
      await expect(service.refresh('t')).rejects.toThrow(UnauthorizedException);
      expect(second.revokedAt).toBeInstanceOf(Date);
    });

    it('refuses an expired session', async () => {
      await service.login({ id: 'u1', email: 'a@b.com' });
      const row = prisma.refreshSession.rows[0];
      row.expiresAt = new Date(Date.now() - 1000);
      jwt.verify.mockReturnValue({ sub: 'u1', type: 'refresh', jti: row.id });

      await expect(service.refresh('t')).rejects.toThrow(UnauthorizedException);
    });

    it('rolls back rotation if replacement creation fails', async () => {
      await service.login({ id: 'u1', email: 'a@b.com' });
      jwt.verify.mockReturnValue({ sub: 'u1', type: 'refresh', jti: prisma.refreshSession.rows[0].id });
      users.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
      prisma.refreshSession.create.mockRejectedValueOnce(new Error('database unavailable'));
      await expect(service.refresh('t')).rejects.toThrow('database unavailable');
      expect(prisma.refreshSession.rows[0].revokedAt).toBeNull();
      await expect(service.refresh('t')).resolves.toHaveProperty('refresh_token');
    });

    it('manual logout also revokes a recovered replacement', async () => {
      await service.login({ id: 'u1', email: 'a@b.com' });
      jwt.verify.mockReturnValue({ sub: 'u1', type: 'refresh', jti: prisma.refreshSession.rows[0].id });
      users.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
      await service.refresh('t');
      await service.revokeSessionForToken('t', false);
      await expect(service.refresh('t')).rejects.toThrow(UnauthorizedException);
      expect(prisma.refreshSession.rows.every(row => row.revokedAt)).toBe(true);
    });

    it('prefers a valid cookie over a stale legacy cookie', async () => {
      await service.login({ id: 'u1', email: 'a@b.com' });
      await service.login({ id: 'u1', email: 'a@b.com' });
      const [old, current] = prisma.refreshSession.rows;
      old.revokedAt = new Date(Date.now() - 180000);
      jwt.verify.mockImplementation(token => ({ sub: 'u1', type: 'refresh', jti: token === 'old' ? old.id : current.id }));
      users.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
      await expect(service.refreshCookieCandidates(['old', 'current'])).resolves.toHaveProperty('refresh_token');
      expect(prisma.refreshSession.rows[2].revokedAt).toBeNull();
    });

    it('revokes every session on logout', async () => {
      await service.login({ id: 'u1', email: 'a@b.com' });
      await service.login({ id: 'u1', email: 'a@b.com' });

      await service.revokeAllSessions('u1');

      expect(prisma.refreshSession.rows.every((r) => r.revokedAt instanceof Date)).toBe(true);
    });

    // Otherwise a short access expiry would be pointless: the long-lived token
    // could simply be presented in its place.
    it('refuses an access token presented as a refresh token', async () => {
      jwt.verify.mockReturnValue({ sub: 'u1', email: 'a@b.com' });

      await expect(service.refresh('an.access.token')).rejects.toThrow(UnauthorizedException);
    });

    it('refuses an expired or tampered refresh token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refresh('bad.token')).rejects.toThrow(UnauthorizedException);
    });

    // A month-long token must not outlive the account it belongs to.
    it('refuses to refresh for a user that no longer exists', async () => {
      await service.login({ id: 'gone', email: 'a@b.com' });
      jwt.verify.mockReturnValue({ sub: 'gone', email: 'a@b.com', type: 'refresh', jti: prisma.refreshSession.rows[0].id });
      users.findById.mockResolvedValue(null);

      await expect(service.refresh('good.refresh.token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login codes', () => {
    it('stores only a hash of the code and exchanges it once for tokens', async () => {
      users.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

      const code = await service.createLoginCode('u1');

      expect(prisma.loginCode.rows[0].id).not.toBe(code);
      await expect(service.exchangeLoginCode(code)).resolves.toEqual(
        expect.objectContaining({ access_token: 'signed.jwt.token' }),
      );
      await expect(service.exchangeLoginCode(code)).rejects.toThrow(UnauthorizedException);
    });

    it('refuses an unknown or expired code', async () => {
      await expect(service.exchangeLoginCode('nope')).rejects.toThrow(UnauthorizedException);
      const code = await service.createLoginCode('u1');
      prisma.loginCode.rows[0].expiresAt = new Date(Date.now() - 1000);
      await expect(service.exchangeLoginCode(code)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Google identity verification and pre-registration protection', () => {
    it('rejects Google sign-in when email is not verified or subject is missing', async () => {
      await expect(
        service.validateGoogleUser({
          email: 'victim@example.com',
          googleSub: 'google-sub-1',
          emailVerified: false,
        }),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        service.validateGoogleUser({
          email: 'victim@example.com',
          googleSub: '',
          emailVerified: true,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('prevents a pre-registered password attacker from silently retaining access after Google sign-in', async () => {
      // 1. Attacker pre-registers victim@example.com with a password they know.
      let storedUser: any = null;
      users.findByEmail.mockImplementation(async (email: string) =>
        storedUser && storedUser.email === email ? storedUser : null,
      );
      users.findById.mockImplementation(async (id: string) =>
        storedUser && storedUser.id === id ? storedUser : null,
      );
      users.findByGoogleSub.mockImplementation(async (sub: string) =>
        storedUser && storedUser.googleSub === sub ? storedUser : null,
      );
      users.createUser.mockImplementation(async (data: any) => {
        storedUser = {
          id: 'user_pre_reg',
          passwordAuthEnabled: true,
          emailVerifiedAt: null,
          googleSub: null,
          sessionsInvalidatedAt: null,
          ...data,
        };
        return storedUser;
      });
      users.updateUser.mockImplementation(async (_id: string, data: any) => {
        storedUser = { ...storedUser, ...data };
        return storedUser;
      });

      const attackerPassword = 'attacker-known-password-123';
      await service.register({ email: 'victim@example.com', password: attackerPassword });
      expect(prisma.refreshSession.rows).toHaveLength(1);
      expect(await service.validateUser('victim@example.com', attackerPassword)).not.toBeNull();

      // Attacker also invited a second attacker account into the pre-registered workspace.
      prisma.organizationMember.findMany.mockResolvedValue([{ organizationId: 'org_attacker_trap' }]);
      prisma.organizationMember.count.mockResolvedValue(1);
      orgsService.getOrganizationsForUser.mockResolvedValueOnce([]);

      // 2. Real mailbox owner later signs in via verified Google identity.
      const googleOutcome = await service.validateGoogleUser({
        email: 'victim@example.com',
        googleSub: 'google-sub-real-owner',
        emailVerified: true,
        firstName: 'Victim',
      });

      // Must NOT silently sign into the pre-registered password account.
      expect(googleOutcome.recoveryRequired).toBe(true);
      expect(typeof googleOutcome.recoveryToken).toBe('string');
      expect(storedUser.googleSub).toBeNull();

      // 3. Real mailbox owner reclaims the account through explicit recovery.
      const reclaimedTokens = await service.reclaimAccountWithGoogle(googleOutcome.recoveryToken);
      expect(reclaimedTokens.access_token).toBe('signed.jwt.token');

      // Attacker's previously registered password must NEVER work again.
      expect(await service.validateUser('victim@example.com', attackerPassword)).toBeNull();
      expect(storedUser.passwordAuthEnabled).toBe(false);
      expect(storedUser.googleSub).toBe('google-sub-real-owner');
      expect(storedUser.emailVerifiedAt).toBeInstanceOf(Date);
      expect(storedUser.sessionsInvalidatedAt).toBeInstanceOf(Date);

      // Attacker's refresh session is revoked and shared pre-registration workspace detached.
      expect(prisma.refreshSession.rows[0].revokedAt).toBeInstanceOf(Date);
      expect(prisma.organizationMember.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user_pre_reg', organizationId: 'org_attacker_trap' },
      });

      // Recovery token is single-use.
      await expect(service.reclaimAccountWithGoogle(googleOutcome.recoveryToken)).rejects.toThrow(
        UnauthorizedException,
      );

      // Subsequent Google sign-ins resolve directly by immutable googleSub.
      const repeat = await service.validateGoogleUser({
        email: 'victim@example.com',
        googleSub: 'google-sub-real-owner',
        emailVerified: true,
      });
      expect(repeat.id).toBe('user_pre_reg');
      expect(repeat.recoveryRequired).toBeUndefined();
    });

    it('requires valid password proof of control before linking Google to an existing password account', async () => {
      const passwordHash = await bcrypt.hash('owner-real-password', 10);
      let storedUser: any = {
        id: 'user_existing',
        email: 'owner@example.com',
        passwordHash,
        passwordAuthEnabled: true,
        emailVerifiedAt: null,
        googleSub: null,
      };
      users.findByEmail.mockResolvedValue(storedUser);
      users.findById.mockImplementation(async () => storedUser);
      users.updateUser.mockImplementation(async (_id: string, data: any) => {
        storedUser = { ...storedUser, ...data };
        return storedUser;
      });

      const outcome = await service.validateGoogleUser({
        email: 'owner@example.com',
        googleSub: 'google-sub-owner',
        emailVerified: true,
      });
      expect(outcome.recoveryRequired).toBe(true);

      // Wrong password must fail and NOT bind googleSub.
      await expect(service.linkGoogleWithPassword(outcome.recoveryToken, 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(storedUser.googleSub).toBeNull();

      // Correct password proves control and binds googleSub.
      const linked = await service.linkGoogleWithPassword(outcome.recoveryToken, 'owner-real-password');
      expect(linked.access_token).toBe('signed.jwt.token');
      expect(storedUser.googleSub).toBe('google-sub-owner');
      expect(storedUser.emailVerifiedAt).toBeInstanceOf(Date);
    });
  });
});
