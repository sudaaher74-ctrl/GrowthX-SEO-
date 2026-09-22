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

  /**
   * The Places-sourced profile fields.
   *
   * These exist because the Business Profile APIs are gated behind a Google
   * approval granted per Cloud project: until it lands, Places is the only
   * readable source for the listing, and an audit with no phone, website,
   * hours or category to look at can only ever check four boxes.
   *
   * What each test here protects is the line between "Google has none" and
   * "nothing asked". A null that means the second must never be rendered as
   * the first.
   */
  describe('connectBusiness — Places profile details', () => {
    const DETAILS = {
      nationalPhoneNumber: '+91 20 2345 6789',
      websiteUri: 'https://milquufresh.in',
      primaryTypeDisplayName: { text: 'Fruit and vegetable wholesaler' },
      types: ['wholesaler', 'food', 'point_of_interest'],
      regularOpeningHours: {
        weekdayDescriptions: ['Monday: 9:00 AM – 6:00 PM', 'Tuesday: 9:00 AM – 6:00 PM'],
      },
      businessStatus: 'OPERATIONAL',
    };

    afterEach(() => {
      delete process.env.GOOGLE_PLACES_API_KEY;
      delete (global as any).fetch;
    });

    it('reads the profile fields from Places and stores them on the location', async () => {
      process.env.GOOGLE_PLACES_API_KEY = 'test-key';
      const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => DETAILS });
      (global as any).fetch = fetchMock;

      const prisma = createInMemoryPrisma();
      const service = new LocalSeoService(prisma as any);

      await service.connectBusiness(projectId, mockPlaceData);

      // Asked Google about the place itself, not carried up from the browser
      // with the rest of the connect payload.
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain(`/v1/places/${mockPlaceData.placeId}`);
      expect(init.headers['X-Goog-FieldMask']).toContain('nationalPhoneNumber');

      // `reviews` and `editorialSummary` sit in Enterprise + Atmosphere,
      // Google's most expensive tier. Requesting either would move the price
      // of every lookup, so the mask must not grow to include them.
      expect(init.headers['X-Goog-FieldMask']).not.toContain('reviews');
      expect(init.headers['X-Goog-FieldMask']).not.toContain('editorialSummary');

      const stored = prisma.locations[0];
      expect(stored.phone).toBe('+91 20 2345 6789');
      expect(stored.websiteUri).toBe('https://milquufresh.in');
      expect(stored.primaryCategory).toBe('Fruit and vegetable wholesaler');
      expect(stored.categories).toEqual(['wholesaler', 'food', 'point_of_interest']);
      expect(stored.hoursWeekdayText).toHaveLength(2);
      expect(stored.businessStatus).toBe('OPERATIONAL');
      // Set only on a read that actually happened, which is what makes the
      // nulls above readable as "Google has none" on any other listing.
      expect(stored.placesDetailsSyncedAt).toBeInstanceOf(Date);
    });

    it('stores nothing Google did not send, rather than a default', async () => {
      process.env.GOOGLE_PLACES_API_KEY = 'test-key';
      // A listing with no phone, no website and no published hours: Places
      // answers with the fields simply absent.
      (global as any).fetch = jest
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ businessStatus: 'OPERATIONAL' }) });

      const prisma = createInMemoryPrisma();
      const service = new LocalSeoService(prisma as any);

      await service.connectBusiness(projectId, mockPlaceData);

      const stored = prisma.locations[0];
      expect(stored.phone).toBeNull();
      expect(stored.websiteUri).toBeNull();
      expect(stored.primaryCategory).toBeNull();
      expect(stored.categories).toEqual([]);
      expect(stored.hoursWeekdayText).toEqual([]);
      // The read succeeded, so these nulls do mean the merchant has not filled
      // them in — which is exactly what the audit is entitled to report.
      expect(stored.placesDetailsSyncedAt).toBeInstanceOf(Date);
    });

    it('still attaches the listing when the details call fails', async () => {
      process.env.GOOGLE_PLACES_API_KEY = 'test-key';
      (global as any).fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () =>
          JSON.stringify({
            error: {
              message: 'The caller does not have permission',
              details: [{ reason: 'API_KEY_SERVICE_BLOCKED', metadata: { consumer: 'projects/1' } }],
            },
          }),
      });

      const prisma = createInMemoryPrisma();
      const service = new LocalSeoService(prisma as any);

      const location = await service.connectBusiness(projectId, mockPlaceData);

      // The location is what the customer asked to attach. Losing it because
      // the extra fields could not be read would leave them with nothing.
      expect(location.businessName).toBe('Apex Dental Care');
      expect(prisma.locations).toHaveLength(1);
      // And nothing claims the merchant has no phone number on the strength
      // of a request that failed.
      expect(prisma.locations[0].placesDetailsSyncedAt).toBeUndefined();
    });

    it('does not overwrite details already read when a later refresh fails', async () => {
      process.env.GOOGLE_PLACES_API_KEY = 'test-key';
      (global as any).fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => DETAILS });

      const prisma = createInMemoryPrisma();
      const service = new LocalSeoService(prisma as any);
      await service.connectBusiness(projectId, mockPlaceData);
      expect(prisma.locations[0].phone).toBe('+91 20 2345 6789');

      // Reconnecting is also the refresh path. A failed refresh must leave the
      // last good read in place rather than blanking the profile.
      (global as any).fetch = jest
        .fn()
        .mockResolvedValue({ ok: false, status: 429, text: async () => 'RESOURCE_EXHAUSTED' });
      await service.connectBusiness(projectId, { ...mockPlaceData, reviewCount: 130 });

      expect(prisma.locations).toHaveLength(1);
      expect(prisma.locations[0].phone).toBe('+91 20 2345 6789');
      expect(prisma.locations[0].reviewCount).toBe(130);
    });

    it('asks Places nothing for a manually entered listing', async () => {
      process.env.GOOGLE_PLACES_API_KEY = 'test-key';
      const fetchMock = jest.fn();
      (global as any).fetch = fetchMock;

      const prisma = createInMemoryPrisma();
      const service = new LocalSeoService(prisma as any);

      // Manual entry has no place id, so there is nothing to ask about, and
      // what the operator typed is stored exactly as typed.
      await service.connectBusiness(projectId, {
        businessName: 'Corner Store',
        address: '5 Side Lane',
        rating: 0,
        reviewCount: 0,
      });

      expect(fetchMock).not.toHaveBeenCalled();
      expect(prisma.locations[0].placesDetailsSyncedAt).toBeUndefined();
    });

    it('asks Places nothing when no key is configured', async () => {
      const fetchMock = jest.fn();
      (global as any).fetch = fetchMock;

      const prisma = createInMemoryPrisma();
      const service = new LocalSeoService(prisma as any);

      await service.connectBusiness(projectId, mockPlaceData);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(prisma.locations).toHaveLength(1);
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
