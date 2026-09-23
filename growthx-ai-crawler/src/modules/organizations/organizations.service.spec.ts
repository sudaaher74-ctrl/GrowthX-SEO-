import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationsService } from './organizations.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let tx: { organization: { create: jest.Mock }; organizationMember: { create: jest.Mock } };
  let prisma: any;

  beforeEach(async () => {
    tx = {
      organization: { create: jest.fn().mockResolvedValue({ id: 'org_1', name: 'Acme' }) },
      organizationMember: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
      organization: {
        findMany: jest.fn().mockResolvedValue([{ id: 'org_1' }]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      organizationMember: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(1),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [OrganizationsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(OrganizationsService);
  });

  it('makes the creator the OWNER in the same transaction', async () => {
    const result = await service.createOrganization('u1', { name: 'Acme', slug: 'acme' } as any);

    expect(result).toMatchObject({ id: 'org_1' });
    expect(tx.organizationMember.create).toHaveBeenCalledWith({
      data: { userId: 'u1', organizationId: 'org_1', role: Role.OWNER },
    });
    // Both writes must be atomic — an org with no owner is unreachable.
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('lists only organizations the user is a member of', async () => {
    await service.getOrganizationsForUser('u1');
    expect(prisma.organization.findMany).toHaveBeenCalledWith({
      where: { members: { some: { userId: 'u1' } } },
    });
  });

  it('stores only the name and slug, never nested writes from the request', async () => {
    await service.createOrganization('u1', {
      name: 'Acme',
      slug: 'acme',
      members: { create: [{ userId: 'victim', role: Role.OWNER }] },
      aiMonthlyBudgetUsd: 0,
    } as any);

    expect(tx.organization.create).toHaveBeenCalledWith({ data: { name: 'Acme', slug: 'acme' } });
  });

  it('refuses a slug that is already taken, instead of failing with a 500', async () => {
    prisma.organization.findUnique.mockResolvedValue({ id: 'org_other' });
    await expect(service.createOrganization('u1', { name: 'Acme', slug: 'acme' })).rejects.toThrow('already taken');
  });

  it("does not list another organization's members", async () => {
    prisma.organizationMember.findUnique.mockResolvedValue(null);
    await expect(service.listMembers('org_other', 'u1')).rejects.toThrow('Organization not found');
    expect(prisma.organizationMember.findMany).not.toHaveBeenCalled();
  });

  describe('owner role', () => {
    const asAdmin = () => prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm_admin', role: Role.ADMIN });

    it('an admin cannot demote an owner', async () => {
      asAdmin();
      prisma.organizationMember.findFirst.mockResolvedValue({ id: 'm_owner', role: Role.OWNER });
      await expect(service.updateMemberRole('org_1', 'u_admin', 'm_owner', Role.MEMBER)).rejects.toThrow('Only an owner');
      expect(prisma.organizationMember.update).not.toHaveBeenCalled();
    });

    it('an admin cannot make someone an owner', async () => {
      asAdmin();
      prisma.organizationMember.findFirst.mockResolvedValue({ id: 'm2', role: Role.MEMBER });
      await expect(service.updateMemberRole('org_1', 'u_admin', 'm2', Role.OWNER)).rejects.toThrow('Only an owner');
    });

    it('an admin cannot remove an owner', async () => {
      asAdmin();
      prisma.organizationMember.findFirst.mockResolvedValue({ id: 'm_owner', role: Role.OWNER });
      await expect(service.removeMember('org_1', 'u_admin', 'm_owner')).rejects.toThrow('Only an owner');
      expect(prisma.organizationMember.delete).not.toHaveBeenCalled();
    });

    it('rejects an unknown role instead of failing in the database', async () => {
      await expect(service.updateMemberRole('org_1', 'u1', 'm2', 'SUPERUSER' as Role)).rejects.toThrow('Role must be one of');
    });
  });
});
