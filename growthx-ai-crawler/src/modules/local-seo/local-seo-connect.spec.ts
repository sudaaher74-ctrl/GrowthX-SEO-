import { LocalSeoService } from './local-seo.service';

describe('LocalSeoService — connectBusiness & location management', () => {
  const projectId = 'proj-seo-100';

  const mockPlaceData = {
    placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    businessName: 'Apex Dental Care',
    address: '123 Main Street, Suite 400, Seattle, WA 98101',
    rating: 4.9,
    reviewCount: 128,
    latitude: 47.6062,
    longitude: -122.3321,
  };

  /**
   * In-memory store that faithfully mirrors Prisma compound unique behavior
   * on @@unique([projectId, placeId]).
   */
  function createInMemoryPrisma() {
    const locations: any[] = [];
    let sequence = 0;

    return {
      locations,
      localLocation: {
        upsert: jest.fn().mockImplementation(async ({ where, update, create }) => {
          const pId = where.projectId_placeId?.projectId ?? where.projectId;
          const plId = where.projectId_placeId?.placeId ?? where.placeId;

          const index = locations.findIndex(
            (loc) => loc.projectId === pId && loc.placeId === plId,
          );

          if (index === -1) {
            const newLoc = {
              id: `loc-${++sequence}`,
              citationsCount: 0,
              rankings: [],
              createdAt: new Date(Date.now() + sequence * 1000),
              updatedAt: new Date(),
              ...create,
            };
            locations.push(newLoc);
            return { ...newLoc };
          }

          locations[index] = {
            ...locations[index],
            ...update,
            updatedAt: new Date(),
          };
          return { ...locations[index] };
        }),

        findFirst: jest.fn().mockImplementation(async ({ where, orderBy }) => {
          const filtered = locations.filter((loc) => loc.projectId === where.projectId);
          if (orderBy?.createdAt === 'asc') {
            filtered.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          }
          return filtered[0] ? { ...filtered[0] } : null;
        }),

        findMany: jest.fn().mockImplementation(async ({ where, orderBy }) => {
          let results = locations.filter((loc) => loc.projectId === where.projectId);
          if (orderBy?.createdAt === 'asc') {
            results = [...results].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          }
          return results.map((r) => ({ ...r }));
        }),
      },

      gbpFixProposal: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'prop-1',
            projectId,
            field: 'profile.description',
            proposedValue: 'Updated description',
            status: 'PENDING',
            createdAt: new Date(),
          },
        ]),
      },
    };
  }

  describe('connectBusiness', () => {
    it('upserts a new location keyed on compound unique (projectId, placeId)', async () => {
      const prisma = createInMemoryPrisma();
      const service = new LocalSeoService(prisma as any);

      const location = await service.connectBusiness(projectId, mockPlaceData);

      expect(prisma.localLocation.upsert).toHaveBeenCalledWith({
        where: {
          projectId_placeId: {
            projectId,
            placeId: mockPlaceData.placeId,
          },
        },
        update: {
          businessName: mockPlaceData.businessName,
          address: mockPlaceData.address,
          rating: mockPlaceData.rating,
          reviewCount: mockPlaceData.reviewCount,
          latitude: mockPlaceData.latitude,
          longitude: mockPlaceData.longitude,
        },
        create: {
          projectId,
          placeId: mockPlaceData.placeId,
          businessName: mockPlaceData.businessName,
          address: mockPlaceData.address,
          rating: mockPlaceData.rating,
          reviewCount: mockPlaceData.reviewCount,
          latitude: mockPlaceData.latitude,
          longitude: mockPlaceData.longitude,
        },
      });

      expect(location.businessName).toBe('Apex Dental Care');
      expect(location.placeId).toBe(mockPlaceData.placeId);
      expect(location.citationsCount).toBe(0);
      expect(prisma.locations).toHaveLength(1);
    });

    it('updates an existing location in place without creating duplicate rows', async () => {
      const prisma = createInMemoryPrisma();
      const service = new LocalSeoService(prisma as any);

      // Connect initial listing
      await service.connectBusiness(projectId, mockPlaceData);
      expect(prisma.locations).toHaveLength(1);
      expect(prisma.locations[0].rating).toBe(4.9);
      expect(prisma.locations[0].reviewCount).toBe(128);

      // Connect same listing again with updated rating and review count
      const updatedPlaceData = {
        ...mockPlaceData,
        rating: 5.0,
        reviewCount: 135,
      };

      const updated = await service.connectBusiness(projectId, updatedPlaceData);

      expect(prisma.locations).toHaveLength(1); // No duplicate rows created
      expect(updated.rating).toBe(5.0);
      expect(updated.reviewCount).toBe(135);
      expect(prisma.locations[0].rating).toBe(5.0);
      expect(prisma.locations[0].reviewCount).toBe(135);
    });

    it('attaching a second distinct place adds a new location to the project', async () => {
      const prisma = createInMemoryPrisma();
      const service = new LocalSeoService(prisma as any);

      await service.connectBusiness(projectId, mockPlaceData);

      const secondPlaceData = {
        placeId: 'ChIJ_second_location_id',
        businessName: 'Apex Dental Care — Bellevue',
        address: '456 Bellevue Way NE, Bellevue, WA 98004',
        rating: 4.8,
        reviewCount: 64,
        latitude: 47.6101,
        longitude: -122.2015,
      };

      await service.connectBusiness(projectId, secondPlaceData);

      expect(prisma.locations).toHaveLength(2);
      expect(prisma.locations[0].placeId).toBe(mockPlaceData.placeId);
      expect(prisma.locations[1].placeId).toBe(secondPlaceData.placeId);
    });

    it('handles missing optional fields (placeId, latitude, longitude) gracefully', async () => {
      const prisma = createInMemoryPrisma();
      const service = new LocalSeoService(prisma as any);

      const minimalPlaceData = {
        businessName: 'Minimal Dental',
        address: '789 Elm St',
        rating: 4.0,
        reviewCount: 10,
      };

      const location = await service.connectBusiness(projectId, minimalPlaceData);

      expect(prisma.localLocation.upsert).toHaveBeenCalledWith({
        where: {
          projectId_placeId: {
            projectId,
            placeId: '',
          },
        },
        update: {
          businessName: 'Minimal Dental',
          address: '789 Elm St',
          rating: 4.0,
          reviewCount: 10,
          latitude: undefined,
          longitude: undefined,
        },
        create: {
          projectId,
          placeId: '',
          businessName: 'Minimal Dental',
          address: '789 Elm St',
          rating: 4.0,
          reviewCount: 10,
          latitude: null,
          longitude: null,
        },
      });

      expect(location.placeId).toBe('');
      expect(location.latitude).toBeNull();
      expect(location.longitude).toBeNull();
    });
  });

  describe('getLocalSeo', () => {
    it('retrieves the primary (oldest) location with rankings included', async () => {
      const prisma = createInMemoryPrisma();
      const service = new LocalSeoService(prisma as any);

      await service.connectBusiness(projectId, mockPlaceData);
      await service.connectBusiness(projectId, {
        ...mockPlaceData,
        placeId: 'ChIJ_second_place',
        businessName: 'Second Clinic',
      });

      const primary = await service.getLocalSeo(projectId);

      expect(prisma.localLocation.findFirst).toHaveBeenCalledWith({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
        include: { rankings: true },
      });

      expect(primary).not.toBeNull();
      expect(primary?.businessName).toBe('Apex Dental Care');
      expect(primary?.placeId).toBe(mockPlaceData.placeId);
    });

    it('returns null when no location has been connected to the project', async () => {
      const prisma = createInMemoryPrisma();
      const service = new LocalSeoService(prisma as any);

      const result = await service.getLocalSeo('empty-project');
      expect(result).toBeNull();
    });
  });

  describe('listLocations', () => {
    it('retrieves all locations for the project sorted oldest first with rankings included', async () => {
      const prisma = createInMemoryPrisma();
      const service = new LocalSeoService(prisma as any);

      await service.connectBusiness(projectId, mockPlaceData);
      await service.connectBusiness(projectId, {
        ...mockPlaceData,
        placeId: 'ChIJ_second_place',
        businessName: 'Second Clinic',
      });

      const list = await service.listLocations(projectId);

      expect(prisma.localLocation.findMany).toHaveBeenCalledWith({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
        include: { rankings: true },
      });

      expect(list).toHaveLength(2);
      expect(list[0].businessName).toBe('Apex Dental Care');
      expect(list[1].businessName).toBe('Second Clinic');
    });
  });

  describe('getProposals', () => {
    it('retrieves fix proposals for the project sorted by createdAt desc', async () => {
      const prisma = createInMemoryPrisma();
      const service = new LocalSeoService(prisma as any);

      const proposals = await service.getProposals(projectId);

      expect(prisma.gbpFixProposal.findMany).toHaveBeenCalledWith({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });
      expect(proposals).toHaveLength(1);
      expect(proposals[0].field).toBe('profile.description');
    });
  });
});
