import {
  LocalOffpageService,
  buildReviewUrl,
  computeLocalProfileAudit,
  detectMarket,
} from './local-offpage.service';
import type { PlacesListing } from '../integrations/google/places-listing.service';

describe('LocalOffpageService', () => {
  const sampleListing: PlacesListing = {
    placeId: 'ChIJ_sample_place_123',
    name: 'Sunrise Fresh Dairy',
    address: 'Plot 12, Sector 4, Pune, Maharashtra 411001, India',
    shortAddress: 'Sector 4, Pune',
    latitude: 18.5204,
    longitude: 73.8567,
    rating: 4.8,
    userRatingCount: 74,
    primaryType: 'dairy_store',
    primaryTypeDisplayName: 'Dairy Store',
    types: [
      { type: 'dairy_store', displayName: 'Dairy Store' },
      { type: 'grocery_store', displayName: 'Grocery Store' },
    ],
    phone: '020 2555 1234',
    internationalPhone: '+91 20 2555 1234',
    website: 'https://sunrisedairy.in/',
    googleMapsUri: 'https://maps.google.com/?cid=12345',
    businessStatus: 'OPERATIONAL',
    editorialSummary: 'Farm-fresh milk delivery.',
    hours: {
      weekdayDescriptions: ['Mon: 6AM-9PM', 'Tue: 6AM-9PM', 'Wed: 6AM-9PM', 'Thu: 6AM-9PM', 'Fri: 6AM-9PM', 'Sat: 6AM-9PM'],
      periods: [],
    },
    reviews: [
      {
        name: 'places/ChIJ_sample/reviews/rev1',
        authorName: 'Aarav K.',
        authorPhotoUrl: null,
        authorUri: null,
        rating: 5,
        text: 'Pure milk delivered on time every morning.',
        publishTime: '2026-11-20T05:00:00Z',
        relativePublishTime: '5 days ago',
        googleMapsUri: 'https://maps.google.com/review/1',
      },
    ],
    photos: [
      { name: 'p1', widthPx: 800, heightPx: 600, url: 'https://img.example/1.jpg', attribution: 'Owner', attributionUri: null },
      { name: 'p2', widthPx: 800, heightPx: 600, url: 'https://img.example/2.jpg', attribution: 'Owner', attributionUri: null },
    ],
  };

  it('computes a deterministic 0-100 local profile audit strictly from real Places fields', () => {
    const audit = computeLocalProfileAudit(sampleListing, 'sunrisedairy.in');
    expect(audit.totalChecks).toBe(8);
    expect(audit.score).toBeGreaterThan(70);
    expect(audit.score).toBeLessThan(100); // warns on missing UTM & low photo count
    expect(audit.checks.find((c) => c.id === 'website')?.status).toBe('WARN');
    expect(audit.checks.find((c) => c.id === 'photos')?.status).toBe('FAIL');
    expect(audit.checks.find((c) => c.id === 'rating')?.status).toBe('PASS');
    expect(audit.checks.find((c) => c.id === 'reviews')?.status).toBe('PASS');
    expect(buildReviewUrl('ChIJ_sample_place_123')).toBe(
      'https://search.google.com/local/writereview?placeid=ChIJ_sample_place_123',
    );
  });

  it('cross-references Indian local directories against Backlink Intelligence sources and connected Maps listing', async () => {
    const prisma: any = {
      backlinkSource: {
        findMany: jest.fn().mockResolvedValue([
          { sourceUrl: 'https://www.justdial.com/Pune/Sunrise-Dairy', status: 'VERIFIED' },
          { sourceUrl: 'https://www.instagram.com/sunrisedairy/', status: 'VERIFIED' },
        ]),
      },
    };
    const places: any = {
      snapshot: jest.fn().mockResolvedValue({
        state: 'READY',
        placeId: sampleListing.placeId,
        listing: sampleListing,
        fetchedAt: new Date('2026-11-25T07:00:00Z'),
        error: null,
        suggestedQuery: null,
      }),
    };
    const reportContext: any = {
      buildForProject: jest.fn().mockResolvedValue({
        businessName: 'Sunrise Fresh Dairy',
        domain: 'sunrisedairy.in',
        industry: 'Fresh Dairy & Milk Delivery',
        offerings: ['A2 Cow Milk', 'Fresh Paneer'],
        primaryCity: 'Pune',
        state: 'Maharashtra',
        country: 'India',
        serviceAreas: ['Pune'],
        coveredAreas: ['Baner'],
        missingAreas: ['Wakad'],
        keyPages: [],
        catalogHighlights: [],
        trustSignals: ['Glass bottles before 7 AM'],
        localPresence: { rating: 4.8, reviewCount: 74, address: sampleListing.address, businessName: 'Sunrise Fresh Dairy' },
        crossModuleSnapshot: { auditHealthScore: 90, pagesAudited: 20, openHighIssues: 2, aiCitationSharePct: 30, rivalCount: 3 },
      }),
    };

    const svc = new LocalOffpageService(prisma, places, { generate: jest.fn() } as any, reportContext);
    const citations = await svc.getCitationsAudit('p1');

    expect(detectMarket('India', 'sunrisedairy.in', '+91 20 2555 1234')).toBe('IN');
    expect(citations.market).toBe('IN');
    expect(citations.directories.find((d) => d.id === 'google-business-profile')?.status).toBe('CONNECTED');
    expect(citations.directories.find((d) => d.id === 'justdial')?.status).toBe('DETECTED_IN_BACKLINKS');
    expect(citations.directories.find((d) => d.id === 'instagram-business')?.status).toBe('DETECTED_IN_BACKLINKS');
    expect(citations.directories.find((d) => d.id === 'sulekha')?.status).toBe('NOT_DETECTED');
    expect(citations.directories.find((d) => d.id === 'magicpin')).toBeDefined();
    expect(citations.canonicalNap.formattedBlock).toContain('Sunrise Fresh Dairy');
  });

  it('generates and caches AI Local Co-Pilot pack, and returns honest ERROR on Gemini failure', async () => {
    const prisma: any = {
      project: { findUnique: jest.fn().mockResolvedValue({ organizationId: 'org1' }) },
    };
    const places: any = {
      snapshot: jest.fn().mockResolvedValue({
        state: 'READY',
        placeId: sampleListing.placeId,
        listing: sampleListing,
        fetchedAt: new Date('2026-11-25T07:00:00Z'),
        error: null,
        suggestedQuery: null,
      }),
    };
    const routerOk: any = {
      generate: jest.fn().mockResolvedValue({
        model: 'gemini-3.1-flash-lite',
        refused: false,
        text: JSON.stringify({
          businessDescription: 'Sunrise Fresh Dairy delivers farm-fresh A2 cow milk across Pune before 7 AM.',
          categorySuggestions: ['Dairy Store', 'Milk Delivery Service', 'Organic Food Store'],
          weeklyPosts: [
            {
              title: 'Fresh A2 Milk Morning Delivery',
              postType: 'UPDATE',
              body: 'Order pure glass-bottled A2 cow milk delivered before 7 AM across Pune.',
              ctaLabel: 'Order Online',
              ctaUrl: 'https://sunrisedairy.in/?utm_source=google&utm_medium=organic&utm_campaign=gbp',
              photoTip: 'Photo of chilled glass milk bottles ready for morning delivery.',
            },
          ],
          qnaPairs: [{ question: 'What time do you deliver in Pune?', answer: 'Before 7 AM daily.' }],
          reviewReplies: [
            {
              reviewName: 'places/ChIJ_sample/reviews/rev1',
              authorName: 'Aarav K.',
              suggestedReply: 'Thank you Aarav! We love delivering pure morning milk to your home in Pune.',
            },
          ],
          whatsappReviewRequest: 'Hi! Loved our fresh milk? Share a quick Google review here: https://search.google.com/local/writereview?placeid=ChIJ_sample_place_123',
        }),
      }),
    };

    const svc = new LocalOffpageService(prisma, places, routerOk);
    const first = await svc.generateCopilotPack('p1');
    const second = await svc.generateCopilotPack('p1');

    expect(first.status).toBe('READY');
    expect(first.reviewReplies[0].rating).toBe(5);
    expect(first.weeklyPosts).toHaveLength(1);
    expect(routerOk.generate).toHaveBeenCalledTimes(1); // cached
    expect(second.businessDescription).toBe(first.businessDescription);

    const routerErr: any = { generate: jest.fn().mockRejectedValue(new Error('quota')) };
    const svcErr = new LocalOffpageService(prisma, places, routerErr);
    const errRes = await svcErr.generateCopilotPack('p2');
    expect(errRes.status).toBe('ERROR');
    expect(errRes.error).toContain('quota');
  });
});
