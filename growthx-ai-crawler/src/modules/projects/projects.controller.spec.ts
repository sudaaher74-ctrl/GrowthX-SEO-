import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { OrgContextService } from '../billing/org-context.service';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let projects: { createProject: jest.Mock; getProjectsByOrganization: jest.Mock; getProjectById: jest.Mock };
  let orgContext: { assertMembership: jest.Mock };

  const req = { user: { userId: 'u1' } };

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

  it('lists projects for an organization the caller belongs to', async () => {
    await expect(controller.getProjectsByOrganization(req, 'org_1')).resolves.toEqual([{ id: 'p1' }]);
    expect(orgContext.assertMembership).toHaveBeenCalledWith('u1', 'org_1');
    expect(projects.getProjectsByOrganization).toHaveBeenCalledWith('org_1');
  });

  it('refuses to list projects for an organization the caller is not in', async () => {
    orgContext.assertMembership.mockRejectedValue(new ForbiddenException());
    await expect(controller.getProjectsByOrganization(req, 'someone_elses_org')).rejects.toThrow(ForbiddenException);
    expect(projects.getProjectsByOrganization).not.toHaveBeenCalled();
  });

  it('creates a project from the request body', async () => {
    const body = { name: 'Acme', organizationId: 'org_1' } as any;
    await controller.createProject(req, body);
    expect(orgContext.assertMembership).toHaveBeenCalledWith('u1', 'org_1');
    expect(projects.createProject).toHaveBeenCalledWith(body);
  });

  it('refuses to create a project inside another organization', async () => {
    orgContext.assertMembership.mockRejectedValue(new ForbiddenException());
    await expect(
      controller.createProject(req, { name: 'Acme', organizationId: 'someone_elses_org' } as any),
    ).rejects.toThrow(ForbiddenException);
    expect(projects.createProject).not.toHaveBeenCalled();
  });

  it('fetches one project by id', async () => {
    await expect(controller.getProjectById(req, 'p1')).resolves.toEqual({ id: 'p1', organizationId: 'org_1' });
    expect(orgContext.assertMembership).toHaveBeenCalledWith('u1', 'org_1');
  });

  it('refuses to fetch a project belonging to another organization', async () => {
    orgContext.assertMembership.mockRejectedValue(new ForbiddenException());
    await expect(controller.getProjectById(req, 'p1')).rejects.toThrow(ForbiddenException);
  });

  it('404s for a project that does not exist', async () => {
    projects.getProjectById.mockResolvedValue(null);
    await expect(controller.getProjectById(req, 'nope')).rejects.toThrow(NotFoundException);
  });
});
