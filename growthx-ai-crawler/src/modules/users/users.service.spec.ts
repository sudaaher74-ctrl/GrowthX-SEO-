import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: { findUnique: jest.Mock; findFirst: jest.Mock; create: jest.Mock } };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() } };
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
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
});
