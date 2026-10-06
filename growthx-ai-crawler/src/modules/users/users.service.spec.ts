import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from './users.service';
import { ProjectsService } from '../projects/projects.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let projects: any;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), delete: jest.fn() },
      organizationMember: { findMany: jest.fn(), count: jest.fn(), deleteMany: jest.fn() },
      organization: { delete: jest.fn() },
      project: { findMany: jest.fn() },
      auditLog: { updateMany: jest.fn() },
      voiceSession: { deleteMany: jest.fn() },
      loginCode: { deleteMany: jest.fn() },
      refreshSession: { deleteMany: jest.fn() },
    };
    projects = {
      deleteProject: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProjectsService, useValue: projects },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it('looks a user up by email, whatever case it was stored or typed in', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'u1', email: 'A@b.com' });
    await expect(service.findByEmail(' a@B.com ')).resolves.toMatchObject({ id: 'u1' });
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'a@B.com', mode: 'insensitive' } },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('returns null for an unknown email rather than throwing', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.findByEmail('nobody@b.com')).resolves.toBeNull();
  });

  it('does not query at all for an empty email', async () => {
    await expect(service.findByEmail('')).resolves.toBeNull();
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('looks a user up by id', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });
    await service.findById('u1');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('creates a user from the provided data', async () => {
    const data = { email: 'a@b.com', passwordHash: 'hashed' } as any;
    prisma.user.create.mockResolvedValue({ id: 'u1', ...data });
    await expect(service.createUser(data)).resolves.toMatchObject({ id: 'u1' });
    expect(prisma.user.create).toHaveBeenCalledWith({ data });
  });

  it('deletes user account and cleans up sole organizations and sessions', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'del@example.com' });
    prisma.organizationMember.findMany.mockResolvedValue([{ organizationId: 'org1' }]);
    prisma.organizationMember.count.mockResolvedValue(1); // sole member
    prisma.project.findMany.mockResolvedValue([{ id: 'p1' }]);

    await service.deleteAccount('u1');

    expect(projects.deleteProject).toHaveBeenCalledWith('p1');
    expect(prisma.organization.delete).toHaveBeenCalledWith({ where: { id: 'org1' } });
    expect(prisma.auditLog.updateMany).toHaveBeenCalledWith({ where: { userId: 'u1' }, data: { userId: null } });
    expect(prisma.voiceSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.loginCode.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.refreshSession.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('detaches user membership when organization has other members', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u2', email: 'shared@example.com' });
    prisma.organizationMember.findMany.mockResolvedValue([{ organizationId: 'org_shared' }]);
    prisma.organizationMember.count.mockResolvedValue(3); // multiple members

    await service.deleteAccount('u2');

    expect(prisma.organizationMember.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u2', organizationId: 'org_shared' },
    });
    expect(prisma.organization.delete).not.toHaveBeenCalled();
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u2' } });
  });
});
