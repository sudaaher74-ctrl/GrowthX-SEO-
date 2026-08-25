import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { OrgContextService } from '../organizations/org-context.service';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let projects: { createProject: jest.Mock; getProjectsByOrganization: jest.Mock; getProjectById: jest.Mock };
  let orgContext: { assertMembership: jest.Mock };

  const alice = { user: { userId: 'user_alice' } };

  beforeEach(async () => {
    projects = {
      createProject: jest.fn().mockResolvedValue({ id: 'p1' }),
      getProjectsByOrganization: jest.fn().mockResolvedValue([{ id: 'p1' }]),
      getProjectById: jest.fn().mockResolvedValue({ id: 'p1', organizationId: 'org_1' }),
    };
    orgContext = { assertMembership: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: ProjectsService, useValue: projects },
        { provide: OrgContextService, useValue: orgContext },
      ],
    }).compile();
    controller = module.get(ProjectsController);
  });

  /** Every route took an id straight from the request and trusted it. */
  function denyMembership() {
    orgContext.assertMembership.mockRejectedValue(new ForbiddenException());
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
    expect(orgContext.assertMembership).toHaveBeenCalledWith('user_alice', 'org_1');
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
});
