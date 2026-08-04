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
      organization: { findMany: jest.fn().mockResolvedValue([{ id: 'org_1' }]) },
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
});
