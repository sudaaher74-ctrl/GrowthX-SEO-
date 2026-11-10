import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { SubscriptionQuotaService } from './subscription-quota.service';
import { PrismaService } from '../../database/prisma.service';

describe('OrganizationsController', () => {
  let controller: OrganizationsController;
  let organizations: {
    createOrganization: jest.Mock;
    getOrganizationsForUser: jest.Mock;
    getWhiteLabel: jest.Mock;
    updateWhiteLabel: jest.Mock;
  };
  let quotaService: { resolveTier: jest.Mock };

  beforeEach(async () => {
    organizations = {
      createOrganization: jest.fn().mockResolvedValue({ id: 'org_1' }),
      getOrganizationsForUser: jest.fn().mockResolvedValue([{ id: 'org_1' }]),
      getWhiteLabel: jest.fn().mockResolvedValue({ whiteLabelEnabled: true, agencyName: 'Apex Agency' }),
      updateWhiteLabel: jest.fn().mockResolvedValue({ whiteLabelEnabled: true, agencyName: 'Apex Agency' }),
    };

    quotaService = {
      resolveTier: jest.fn().mockReturnValue('agency'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrganizationsController],
      providers: [
        { provide: OrganizationsService, useValue: organizations },
        { provide: SubscriptionQuotaService, useValue: quotaService },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    controller = module.get(OrganizationsController);
  });

  it('scopes the list to the authenticated user', async () => {
    const req = { user: { userId: 'u1' } };
    await expect(controller.getOrganizations(req)).resolves.toEqual([{ id: 'org_1' }]);
    expect(organizations.getOrganizationsForUser).toHaveBeenCalledWith('u1');
  });

  it('creates an organization owned by the caller', async () => {
    const req = { user: { userId: 'u1' } };
    await controller.createOrganization(req, { name: 'Acme', slug: 'acme' } as any);
    expect(organizations.createOrganization).toHaveBeenCalledWith('u1', { name: 'Acme', slug: 'acme' });
  });

  it('retrieves white label settings for an organization', async () => {
    await expect(controller.getWhiteLabel('org_1')).resolves.toEqual({
      whiteLabelEnabled: true,
      agencyName: 'Apex Agency',
    });
    expect(organizations.getWhiteLabel).toHaveBeenCalledWith('org_1');
  });

  it('updates white label settings with resolved subscription tier', async () => {
    const req = { user: { userId: 'u1' }, headers: { 'x-subscription-tier': 'agency' } };
    await controller.updateWhiteLabel(req, 'org_1', {
      whiteLabelEnabled: true,
      agencyName: 'Apex Agency',
    });
    expect(quotaService.resolveTier).toHaveBeenCalledWith(req);
    expect(organizations.updateWhiteLabel).toHaveBeenCalledWith('org_1', 'u1', 'agency', {
      whiteLabelEnabled: true,
      agencyName: 'Apex Agency',
    });
  });
});
