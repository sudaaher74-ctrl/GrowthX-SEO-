import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let prisma: { project: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock } };

  beforeEach(async () => {
    prisma = { project: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProjectsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ProjectsService);
  });

  it('creates a project', async () => {
    const data = { name: 'Acme', organization: { connect: { id: 'org_1' } } } as any;
    prisma.project.create.mockResolvedValue({ id: 'p1', name: 'Acme' });
    await expect(service.createProject(data)).resolves.toMatchObject({ id: 'p1' });
    expect(prisma.project.create).toHaveBeenCalledWith({ data });
  });

  it('scopes the project list to one organization', async () => {
    prisma.project.findMany.mockResolvedValue([{ id: 'p1' }]);
    await service.getProjectsByOrganization('org_1');
    expect(prisma.project.findMany).toHaveBeenCalledWith({ where: { organizationId: 'org_1' } });
  });

  it('returns null for a project that does not exist', async () => {
    prisma.project.findUnique.mockResolvedValue(null);
    await expect(service.getProjectById('missing')).resolves.toBeNull();
  });
});
