import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let projects: { createProject: jest.Mock; getProjectsByOrganization: jest.Mock; getProjectById: jest.Mock };

  beforeEach(async () => {
    projects = {
      createProject: jest.fn().mockResolvedValue({ id: 'p1' }),
      getProjectsByOrganization: jest.fn().mockResolvedValue([{ id: 'p1' }]),
      getProjectById: jest.fn().mockResolvedValue({ id: 'p1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [{ provide: ProjectsService, useValue: projects }],
    }).compile();
    controller = module.get(ProjectsController);
  });

  it('lists projects for an organization', async () => {
    await expect(controller.getProjectsByOrganization('org_1')).resolves.toEqual([{ id: 'p1' }]);
    expect(projects.getProjectsByOrganization).toHaveBeenCalledWith('org_1');
  });

  it('creates a project from the request body', async () => {
    const body = { name: 'Acme' } as any;
    await controller.createProject(body);
    expect(projects.createProject).toHaveBeenCalledWith(body);
  });

  it('fetches one project by id', async () => {
    await expect(controller.getProjectById('p1')).resolves.toEqual({ id: 'p1' });
  });
});
