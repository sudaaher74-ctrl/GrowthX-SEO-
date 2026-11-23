import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminController } from './admin.controller';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformAdminService } from './platform-admin.service';
import { TokensAdminController } from '../tokens/tokens.controller';
import { MammouthSeoController } from '../ai-engine/mammouth-seo.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthService } from '../auth/auth.service';

function makeContext(user?: Record<string, any>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('PlatformAdminService & PlatformAdminGuard', () => {
  const originalEnvUserIds = process.env.PLATFORM_ADMIN_USER_IDS;
  const originalEnvEmails = process.env.PLATFORM_ADMIN_EMAILS;

  let usersById: Map<string, any>;
  let prisma: any;
  let service: PlatformAdminService;
  let guard: PlatformAdminGuard;

  beforeEach(() => {
    delete process.env.PLATFORM_ADMIN_USER_IDS;
    delete process.env.PLATFORM_ADMIN_EMAILS;
    usersById = new Map();
    prisma = {
      user: {
        findUnique: jest.fn(({ where }) => Promise.resolve(usersById.get(where.id) ?? null)),
      },
      refreshSession: {
        create: jest.fn().mockResolvedValue({
          id: 'sess-1',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 86_400_000),
        }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    service = new PlatformAdminService(prisma);
    guard = new PlatformAdminGuard(service);
  });

  afterAll(() => {
    if (originalEnvUserIds === undefined) delete process.env.PLATFORM_ADMIN_USER_IDS;
    else process.env.PLATFORM_ADMIN_USER_IDS = originalEnvUserIds;
    if (originalEnvEmails === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
    else process.env.PLATFORM_ADMIN_EMAILS = originalEnvEmails;
  });

  it('denies a fresh public signup even for the former hard-coded owner address or PLATFORM_ADMIN_EMAILS', async () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'milquufresh@gmail.com,ops@example.com';

    const createdUsers: any[] = [];
    const usersService = {
      findByEmail: jest.fn().mockResolvedValue(null),
      createUser: jest.fn(async (data: any) => {
        const user = {
          id: 'user-fresh-signup-1',
          email: data.email,
          passwordHash: data.passwordHash,
          emailVerifiedAt: data.emailVerifiedAt ?? null,
          isPlatformAdmin: data.isPlatformAdmin ?? false,
          platformAdminGrantedAt: null,
          platformAdminRevokedAt: null,
        };
        createdUsers.push(user);
        usersById.set(user.id, user);
        return user;
      }),
    };
    const authService = new AuthService(
      usersService as any,
      { sign: jest.fn().mockReturnValue('tok') } as any,
      { createOrganization: jest.fn().mockResolvedValue({ id: 'org-1' }) } as any,
      prisma,
    );

    await authService.register({
      email: 'milquufresh@gmail.com',
      password: 'Password123!',
      firstName: 'Claimant',
    });

    expect(createdUsers[0].emailVerifiedAt).toBeNull();
    expect(createdUsers[0].isPlatformAdmin).toBe(false);

    await expect(
      guard.canActivate(makeContext({ userId: 'user-fresh-signup-1', email: 'milquufresh@gmail.com' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies an ordinary verified user who is not provisioned as an operator', async () => {
    usersById.set('user-ordinary', {
      id: 'user-ordinary',
      emailVerifiedAt: new Date('2026-10-01T00:00:00Z'),
      isPlatformAdmin: false,
      platformAdminRevokedAt: null,
    });

    await expect(
      guard.canActivate(makeContext({ userId: 'user-ordinary', email: 'customer@example.com' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies an unverified user even if their immutable ID is placed in PLATFORM_ADMIN_USER_IDS', async () => {
    process.env.PLATFORM_ADMIN_USER_IDS = 'user-unverified-op';
    usersById.set('user-unverified-op', {
      id: 'user-unverified-op',
      emailVerifiedAt: null,
      isPlatformAdmin: true,
      platformAdminRevokedAt: null,
    });

    await expect(
      guard.canActivate(makeContext({ userId: 'user-unverified-op', email: 'unverified@example.com' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a configured verified operator provisioned via PLATFORM_ADMIN_USER_IDS', async () => {
    process.env.PLATFORM_ADMIN_USER_IDS = 'op-verified-1, op-verified-2';
    usersById.set('op-verified-1', {
      id: 'op-verified-1',
      emailVerifiedAt: new Date('2026-10-01T00:00:00Z'),
      isPlatformAdmin: false,
      platformAdminRevokedAt: null,
    });

    await expect(
      guard.canActivate(makeContext({ userId: 'op-verified-1', email: 'operator@example.com' })),
    ).resolves.toBe(true);
  });

  it('allows a verified operator provisioned explicitly in the database', async () => {
    usersById.set('op-db-1', {
      id: 'op-db-1',
      emailVerifiedAt: new Date('2026-10-01T00:00:00Z'),
      isPlatformAdmin: true,
      platformAdminRevokedAt: null,
    });

    await expect(
      guard.canActivate(makeContext({ userId: 'op-db-1', email: 'operator@example.com' })),
    ).resolves.toBe(true);
  });

  it('denies a revoked operator immediately even if their ID remains in PLATFORM_ADMIN_USER_IDS', async () => {
    process.env.PLATFORM_ADMIN_USER_IDS = 'op-revoked-1';
    usersById.set('op-revoked-1', {
      id: 'op-revoked-1',
      emailVerifiedAt: new Date('2026-10-01T00:00:00Z'),
      isPlatformAdmin: false,
      platformAdminRevokedAt: new Date('2026-11-23T00:00:00Z'),
    });

    await expect(
      guard.canActivate(makeContext({ userId: 'op-revoked-1', email: 'former-op@example.com' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('guards every platform-operator controller with JwtAuthGuard and PlatformAdminGuard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController)).toEqual(
      expect.arrayContaining([JwtAuthGuard, PlatformAdminGuard]),
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, TokensAdminController)).toEqual(
      expect.arrayContaining([JwtAuthGuard, PlatformAdminGuard]),
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, MammouthSeoController)).toEqual(
      expect.arrayContaining([JwtAuthGuard]),
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, MammouthSeoController.prototype.updateConfig)).toEqual(
      expect.arrayContaining([PlatformAdminGuard]),
    );
  });
});
