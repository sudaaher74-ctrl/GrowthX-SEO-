import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// The guard holds its own Prisma client; these tests stand in for the rows it reads.
const mockPrisma = {
  project: { findUnique: jest.fn() },
  organizationMember: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
};
jest.mock('@prisma/client', () => ({
  ...jest.requireActual('@prisma/client'),
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
}));

import { JwtAuthGuard } from './jwt-auth.guard';
import { ALLOW_WITHOUT_ORGANIZATION } from './allow-without-organization.decorator';

/**
 * The guard is what stands between a membership row and the rest of the API.
 * An account that resolves to no organization used to be let through, which
 * dropped the tenant filter on reads and failed writes as an opaque 500.
 */
describe('JwtAuthGuard — organization resolution', () => {
  const parentPrototype = Object.getPrototypeOf(JwtAuthGuard.prototype);
  let previousEnv: string | undefined;

  beforeAll(() => {
    previousEnv = process.env.NODE_ENV;
    // The non-production branch is a dev convenience that bypasses all of this.
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    process.env.NODE_ENV = previousEnv;
  });

  beforeEach(() => {
    jest.spyOn(parentPrototype, 'canActivate').mockResolvedValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  function contextFor(user: unknown, params: Record<string, string> = {}) {
    const request: any = { user, params, method: 'POST', url: '/api/projects/p1/content-intelligence/strategy/generate' };
    return {
      request,
      context: {
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => function handler() {},
        getClass: () => class Controller {},
      } as unknown as ExecutionContext,
    };
  }

  function guardWith(exempt: boolean) {
    const reflector = new Reflector();
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: any) => (key === ALLOW_WITHOUT_ORGANIZATION ? exempt : undefined) as any);
    return new JwtAuthGuard(reflector);
  }

  it('puts the resolved organization where the API reads it', async () => {
    const { context, request } = contextFor({ userId: 'u1', email: 'a@b.c', organizationId: 'org_1' });

    await expect(guardWith(false).canActivate(context)).resolves.toBe(true);
    expect(request.organizationId).toBe('org_1');
  });

  it('refuses a workspace-scoped route when the account belongs to no organization', async () => {
    const { context } = contextFor({ userId: 'u1', email: 'stranded@example.com' });

    await expect(guardWith(false).canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('still lets that account reach the routes that create its first organization', async () => {
    const { context } = contextFor({ userId: 'u1', email: 'stranded@example.com' });

    await expect(guardWith(true).canActivate(context)).resolves.toBe(true);
  });

  it('does not mask a failed authentication as a membership problem', async () => {
    jest.spyOn(parentPrototype, 'canActivate').mockResolvedValue(false);
    const { context } = contextFor(undefined);

    await expect(guardWith(false).canActivate(context)).resolves.toBe(false);
  });

  describe('project scope', () => {
    const user = () => ({ userId: 'u1', email: 'a@b.c', organizationId: 'org_1' });

    it("refuses another organization's project, without confirming it exists", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ organizationId: 'org_other' });
      mockPrisma.organizationMember.findUnique.mockResolvedValue(null);
      const { context } = contextFor(user(), { projectId: 'p_other' });

      await expect(guardWith(false).canActivate(context)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses a project that does not exist the same way', async () => {
      mockPrisma.project.findUnique.mockResolvedValue(null);
      const { context } = contextFor(user(), { projectId: 'missing' });

      await expect(guardWith(false).canActivate(context)).rejects.toBeInstanceOf(NotFoundException);
    });

    it("scopes the request to the project's organization for a member", async () => {
      mockPrisma.project.findUnique.mockResolvedValue({ organizationId: 'org_2' });
      mockPrisma.organizationMember.findUnique.mockResolvedValue({ id: 'm1' });
      const { context, request } = contextFor(user(), { projectId: 'p2' });

      await expect(guardWith(false).canActivate(context)).resolves.toBe(true);
      expect(mockPrisma.organizationMember.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId_organizationId: { userId: 'u1', organizationId: 'org_2' } } }),
      );
      expect(request.organizationId).toBe('org_2');
    });

    it('leaves routes without a project untouched', async () => {
      mockPrisma.project.findUnique.mockClear();
      const { context } = contextFor(user());

      await expect(guardWith(false).canActivate(context)).resolves.toBe(true);
      expect(mockPrisma.project.findUnique).not.toHaveBeenCalled();
    });
  });

  it('never signs a tokenless request in as the dev user unless explicitly enabled', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.AUTH_DEV_BYPASS;
    mockPrisma.user.findUnique.mockClear();
    jest.spyOn(parentPrototype, 'canActivate').mockResolvedValue(false);
    const { context } = contextFor(undefined);

    await expect(guardWith(false).canActivate(context)).resolves.toBe(false);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    process.env.NODE_ENV = 'production';
  });
});
