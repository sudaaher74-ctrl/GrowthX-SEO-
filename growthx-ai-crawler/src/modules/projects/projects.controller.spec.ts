import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { OrgContextService } from '../organizations/org-context.service';
import { SubscriptionQuotaService } from '../organizations/subscription-quota.service';
import { PrismaService } from '../../database/prisma.service';
import { PlatformAdminService } from '../admin/platform-admin.service';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let projects: { createProject: jest.Mock; getProjectsByOrganization: jest.Mock; getProjectById: jest.Mock; deleteProject: jest.Mock };
  let orgContext: { assertMembership: jest.Mock; assertCanWrite: jest.Mock; assertManager: jest.Mock };
  let platformAdmin: { isPlatformAdmin: jest.Mock };

  const alice = { user: { userId: 'user_alice' } };

  beforeEach(async () => {
    projects = {
      createProject: jest.fn().mockResolvedValue({ id: 'p1' }),
      getProjectsByOrganization: jest.fn().mockResolvedValue([{ id: 'p1' }]),
      getProjectById: jest.fn().mockResolvedValue({ id: 'p1', organizationId: 'org_1' }),
      deleteProject: jest.fn().mockResolvedValue(undefined),
    };
    orgContext = { assertMembership: jest.fn().mockResolvedValue(undefined), assertCanWrite: jest.fn().mockResolvedValue(undefined),
      assertManager: jest.fn().mockResolvedValue(undefined),
    };
    platformAdmin = { isPlatformAdmin: jest.fn().mockResolvedValue(false) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: ProjectsService, useValue: projects },
        { provide: OrgContextService, useValue: orgContext },
        {
          provide: SubscriptionQuotaService,
          useValue: {
            resolveTierForOrganization: jest.fn().mockResolvedValue('founder_free'),
            assertWebsiteQuota: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: PlatformAdminService, useValue: platformAdmin },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    controller = module.get(ProjectsController);
  });

  /** Every route took an id straight from the request and trusted it. */
  function denyMembership() {
    orgContext.assertMembership.mockRejectedValue(new ForbiddenException());
    orgContext.assertCanWrite.mockRejectedValue(new ForbiddenException());
    orgContext.assertManager.mockRejectedValue(new ForbiddenException());
  }

  it('lists projects for an organization the caller belongs to', async () => {
    await expect(controller.getProjectsByOrganization(alice, 'org_1')).resolves.toEqual([{ id: 'p1' }]);
    expect(orgContext.assertMembership).toHaveBeenCalledWith('user_alice', 'org_1');
    expect(projects.getProjectsByOrganization).toHaveBeenCalledWith('org_1');
  });

  it('refuses to list projects for an organization the caller is not in', async () => {
    denyMembership();
    await expect(controller.getProjectsByOrganization(alice, 'org_someone_else')).rejects.toThrow(ForbiddenException);
    expect(projects.getProjectsByOrganization).not.toHaveBeenCalled();
  });

  it('creates a project in an organization the caller belongs to', async () => {
    await controller.createProject(alice, { name: 'Acme', organizationId: 'org_1' });
    expect(orgContext.assertCanWrite).toHaveBeenCalledWith('user_alice', 'org_1');
    expect(projects.createProject).toHaveBeenCalledWith({
      name: 'Acme',
      tier: undefined,
      organization: { connect: { id: 'org_1' } },
    });
  });

  it('refuses to create a project inside someone else’s organization', async () => {
    denyMembership();
    await expect(
      controller.createProject(alice, { name: 'pwned', organizationId: 'org_someone_else' }),
    ).rejects.toThrow(ForbiddenException);
    expect(projects.createProject).not.toHaveBeenCalled();
  });

  it('fetches one project the caller may see', async () => {
    await expect(controller.getProjectById(alice, 'p1')).resolves.toEqual({ id: 'p1', organizationId: 'org_1' });
    expect(orgContext.assertMembership).toHaveBeenCalledWith('user_alice', 'org_1');
  });

  it('refuses to fetch a project belonging to another organization', async () => {
    denyMembership();
    await expect(controller.getProjectById(alice, 'p1')).rejects.toThrow(ForbiddenException);
  });

  it('404s on a project that does not exist', async () => {
    projects.getProjectById.mockResolvedValue(null);
    await expect(controller.getProjectById(alice, 'nope')).rejects.toThrow(NotFoundException);
  });

  it('deletes a project when the caller manages its organization', async () => {
    await expect(controller.deleteProject(alice, 'p1')).resolves.toEqual({ success: true });
    expect(orgContext.assertManager).toHaveBeenCalledWith('user_alice', 'org_1');
    expect(projects.deleteProject).toHaveBeenCalledWith('p1');
  });

  it('refuses to delete a project the caller does not manage', async () => {
    denyMembership();
    await expect(controller.deleteProject(alice, 'p1')).rejects.toThrow(ForbiddenException);
    expect(projects.deleteProject).not.toHaveBeenCalled();
  });

  it('404s when deleting a project that does not exist', async () => {
    projects.getProjectById.mockResolvedValue(null);
    await expect(controller.deleteProject(alice, 'nope')).rejects.toThrow(NotFoundException);
    expect(projects.deleteProject).not.toHaveBeenCalled();
  });

  it('refuses cross-org deletion even when PLATFORM_ADMIN_EMAILS contains the caller email', async () => {
    const prev = process.env.PLATFORM_ADMIN_EMAILS;
    process.env.PLATFORM_ADMIN_EMAILS = 'operator@example.com,milquufresh@gmail.com';
    try {
      denyMembership();
      platformAdmin.isPlatformAdmin.mockResolvedValue(false);
      await expect(
        controller.deleteProject({ user: { userId: 'unverified_signup', email: 'milquufresh@gmail.com' } }, 'p1'),
      ).rejects.toThrow(ForbiddenException);
      expect(platformAdmin.isPlatformAdmin).toHaveBeenCalledWith('unverified_signup');
      expect(projects.deleteProject).not.toHaveBeenCalled();
    } finally {
      if (prev === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
      else process.env.PLATFORM_ADMIN_EMAILS = prev;
    }
  });

  it('allows an explicitly verified platform admin to delete a project across organizations', async () => {
    denyMembership();
    platformAdmin.isPlatformAdmin.mockResolvedValue(true);
    await expect(controller.deleteProject({ user: { userId: 'verified_op_1' } }, 'p1')).resolves.toEqual({ success: true });
    expect(platformAdmin.isPlatformAdmin).toHaveBeenCalledWith('verified_op_1');
    expect(projects.deleteProject).toHaveBeenCalledWith('p1');
  });
});
