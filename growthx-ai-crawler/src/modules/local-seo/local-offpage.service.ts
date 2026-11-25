import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  PlacesListing,
  PlacesListingService,
  PlacesSnapshotState,
} from '../integrations/google/places-listing.service';
import { AiProvider, AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { extractAndParseJson } from '../ai-engine/utils/json-extractor.util';
import { UnifiedReportContextService } from '../report-context/unified-report-context.service';
import { BusinessContextSummary, formatBusinessContextForPrompt } from '../report-context/report-playbook.types';

export type LocalCheckStatus = 'PASS' | 'WARN' | 'FAIL';
export type LocalImpact = 'HIGH' | 'MEDIUM' | 'LOW';

export interface LocalProfileAuditCheck {
  id: string;
  label: string;
  status: LocalCheckStatus;
  value: string;
  recommendation: string;
  impact: LocalImpact;
}

export interface LocalProfileAudit {
  state: PlacesSnapshotState;
  placeId: string | null;
  fetchedAt: string | null;
  error: string | null;
  suggestedQuery: string | null;
  listing: PlacesListing | null;
  links: {
    reviewUrl: string | null;
    mapsUrl: string | null;
    manageProfileUrl: string;
    utmWebsiteUrl: string | null;
  };
  audit: {
    score: number;
    passedCount: number;
    totalChecks: number;
    checks: LocalProfileAuditCheck[];
  } | null;
  businessContext: BusinessContextSummary | null;
}

export interface LocalCopilotPost {
  title: string;
  postType: 'UPDATE' | 'OFFER';
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  photoTip: string;
}

export interface LocalCopilotQna {
  question: string;
  answer: string;
}

export interface LocalCopilotReviewReply {
  reviewName: string;
  authorName: string;
  rating: number | null;
  originalText: string | null;
  suggestedReply: string;
}

export interface LocalCopilotPack {
  status: 'READY' | 'ERROR';
  generatedAt: string;
  model: string | null;
  error: string | null;
  businessDescription: string;
  categorySuggestions: string[];
  weeklyPosts: LocalCopilotPost[];
  qnaPairs: LocalCopilotQna[];
  reviewReplies: LocalCopilotReviewReply[];
  whatsappReviewRequest: string;
  manageProfileUrl: string;
  reviewUrl: string | null;
}

export type CitationMarket = 'IN' | 'US' | 'UK' | 'AE' | 'GLOBAL';
export type CitationCategory = 'MAPS_ENGINE' | 'LOCAL_DIRECTORY' | 'SOCIAL_ENTITY' | 'INDUSTRY_NICHE';
export type CitationStatus = 'CONNECTED' | 'DETECTED_IN_BACKLINKS' | 'NOT_DETECTED';

export interface LocalDirectoryEntry {
  id: string;
  name: string;
  domain: string;
  category: CitationCategory;
  priority: 'HIGH' | 'MEDIUM';
  status: CitationStatus;
  detectedUrl: string | null;
  submitUrl: string;
  whyItMatters: string;
}

export interface LocalCitationsAudit {
  market: CitationMarket;
  canonicalNap: {
    businessName: string;
    address: string | null;
    phone: string | null;
    website: string | null;
    utmWebsite: string | null;
    formattedBlock: string;
  };
  summary: {
    totalDirectories: number;
    coveredCount: number;
    missingCount: number;
    highPriorityMissing: number;
    backlinkSourcesScanned: number;
  };
  directories: LocalDirectoryEntry[];
}

interface DirectoryCatalogItem {
  id: string;
  name: string;
  domain: string;
  aliases?: string[];
  category: CitationCategory;
  priority: 'HIGH' | 'MEDIUM';
  submitUrl: string;
  whyItMatters: string;
  markets: CitationMarket[];
  industryMatch?: RegExp;
}

const DIRECTORY_CATALOG: DirectoryCatalogItem[] = [
  {
    id: 'google-business-profile',
    name: 'Google Business Profile (Maps)',
    domain: 'google.com',
    aliases: ['g.page', 'maps.google.com', 'goo.gl'],
    category: 'MAPS_ENGINE',
    priority: 'HIGH',
    submitUrl: 'https://www.google.com/business/',
    whyItMatters: 'Primary ranking signal for Google Maps Top 3 Pack and the #1 local entity source checked by Gemini & ChatGPT.',
    markets: ['IN', 'US', 'UK', 'AE', 'GLOBAL'],
  },
  {
    id: 'apple-business-connect',
    name: 'Apple Business Connect (Apple Maps)',
    domain: 'maps.apple.com',
    aliases: ['businessconnect.apple.com'],
    category: 'MAPS_ENGINE',
    priority: 'HIGH',
    submitUrl: 'https://businessconnect.apple.com/',
    whyItMatters: 'Powers iPhone Siri search, Apple Maps navigation, and ChatGPT/Apple Intelligence local lookups.',
    markets: ['IN', 'US', 'UK', 'AE', 'GLOBAL'],
  },
  {
    id: 'bing-places',
    name: 'Bing Places for Business',
    domain: 'bing.com',
    aliases: ['bingplaces.com'],
    category: 'MAPS_ENGINE',
    priority: 'HIGH',
    submitUrl: 'https://www.bingplaces.com/',
    whyItMatters: 'Feeds Microsoft Copilot and ChatGPT web search local grounding; supports 1-click import from Google.',
    markets: ['IN', 'US', 'UK', 'AE', 'GLOBAL'],
  },
  {
    id: 'justdial',
    name: 'Justdial',
    domain: 'justdial.com',
    category: 'LOCAL_DIRECTORY',
    priority: 'HIGH',
    submitUrl: 'https://www.justdial.com/Free-Listing',
    whyItMatters: 'One of the most frequently cited Indian local directories in Google organic results and AI assistant answers.',
    markets: ['IN'],
  },
  {
    id: 'sulekha',
    name: 'Sulekha',
    domain: 'sulekha.com',
    category: 'LOCAL_DIRECTORY',
    priority: 'HIGH',
    submitUrl: 'https://www.sulekha.com/business-listing',
    whyItMatters: 'High-trust Indian service & local business directory that reinforces city and neighborhood NAP consistency.',
    markets: ['IN'],
  },
  {
    id: 'indiamart',
    name: 'IndiaMART',
    domain: 'indiamart.com',
    category: 'LOCAL_DIRECTORY',
    priority: 'HIGH',
    submitUrl: 'https://seller.indiamart.com/',
    whyItMatters: 'Strong domain authority for Indian product suppliers, food/dairy producers, manufacturers, and B2B/bulk buyers.',
    markets: ['IN'],
  },
  {
    id: 'magicpin',
    name: 'Magicpin',
    domain: 'magicpin.in',
    category: 'INDUSTRY_NICHE',
    priority: 'MEDIUM',
    submitUrl: 'https://magicpin.in/merchant/',
    whyItMatters: 'High hyper-local discovery directory in Indian metros for food, dairy, retail, and neighborhood stores.',
    markets: ['IN'],
    industryMatch: /food|dairy|milk|grocery|restaurant|cafe|bakery|retail|salon|store|shop|sweet/i,
  },
  {
    id: 'zomato',
    name: 'Zomato',
    domain: 'zomato.com',
    category: 'INDUSTRY_NICHE',
    priority: 'MEDIUM',
    submitUrl: 'https://www.zomato.com/partner-with-us',
    whyItMatters: 'Major Indian food & beverage discovery platform heavily cited by AI search engines for local food recommendations.',
    markets: ['IN', 'AE'],
    industryMatch: /food|restaurant|cafe|bakery|cloud kitchen|sweet|beverage|catering/i,
  },
  {
    id: 'practo',
    name: 'Practo',
    domain: 'practo.com',
    category: 'INDUSTRY_NICHE',
    priority: 'HIGH',
    submitUrl: 'https://www.practo.com/providers',
    whyItMatters: 'Top Indian healthcare citation source directly used by Google and AI assistants for clinic/doctor trust.',
    markets: ['IN'],
    industryMatch: /clinic|dental|dentist|doctor|hospital|health|medical|physio|derma|eye|diagnostic/i,
  },
  {
    id: 'tradeindia',
    name: 'TradeIndia',
    domain: 'tradeindia.com',
    category: 'INDUSTRY_NICHE',
    priority: 'MEDIUM',
    submitUrl: 'https://www.tradeindia.com/seller/',
    whyItMatters: 'Strong B2B supplier citation directory in India for manufacturers, exporters, and wholesalers.',
    markets: ['IN'],
    industryMatch: /b2b|wholesale|manufactur|export|supplier|industrial|machinery|packaging|chemical|pharma/i,
  },
  {
    id: 'yelp',
    name: 'Yelp for Business',
    domain: 'yelp.com',
    category: 'LOCAL_DIRECTORY',
    priority: 'HIGH',
    submitUrl: 'https://biz.yelp.com/',
    whyItMatters: 'Core local review & citation authority powering Apple Maps and ChatGPT local recommendations.',
    markets: ['US', 'UK', 'GLOBAL'],
  },
  {
    id: 'yell',
    name: 'Yell.com',
    domain: 'yell.com',
    category: 'LOCAL_DIRECTORY',
    priority: 'HIGH',
    submitUrl: 'https://www.yell.com/free-listing/',
    whyItMatters: 'Leading UK local business directory for consistent NAP citations and regional authority.',
    markets: ['UK'],
  },
  {
    id: 'bbb',
    name: 'Better Business Bureau (BBB)',
    domain: 'bbb.org',
    category: 'LOCAL_DIRECTORY',
    priority: 'MEDIUM',
    submitUrl: 'https://www.bbb.org/get-listed',
    whyItMatters: 'High-authority trust citation signal for US businesses and service providers.',
    markets: ['US'],
  },
  {
    id: 'yellowpages-uae',
    name: 'Yellow Pages UAE',
    domain: 'yellowpages-uae.com',
    category: 'LOCAL_DIRECTORY',
    priority: 'HIGH',
    submitUrl: 'https://www.yellowpages-uae.com/add-business',
    whyItMatters: 'Key UAE business directory supporting local entity verification and NAP consistency.',
    markets: ['AE'],
  },
  {
    id: 'facebook-page',
    name: 'Facebook Business Page',
    domain: 'facebook.com',
    category: 'SOCIAL_ENTITY',
    priority: 'HIGH',
    submitUrl: 'https://www.facebook.com/pages/create',
    whyItMatters: 'Public address, hours, reviews, and website link act as a major cross-verified social entity signal.',
    markets: ['IN', 'US', 'UK', 'AE', 'GLOBAL'],
  },
  {
    id: 'instagram-business',
    name: 'Instagram Professional Profile',
    domain: 'instagram.com',
    category: 'SOCIAL_ENTITY',
    priority: 'HIGH',
    submitUrl: 'https://business.instagram.com/',
    whyItMatters: 'Local discovery & social proof hub; bio UTM link tracks Instagram-to-website visits cleanly in GA4.',
    markets: ['IN', 'US', 'UK', 'AE', 'GLOBAL'],
  },
  {
    id: 'linkedin-company',
    name: 'LinkedIn Company Page',
    domain: 'linkedin.com',
    category: 'SOCIAL_ENTITY',
    priority: 'MEDIUM',
    submitUrl: 'https://www.linkedin.com/company/setup/new/',
    whyItMatters: 'Strong brand entity corroboration frequently crawled and cited by LLMs and Google Knowledge Graph.',
    markets: ['IN', 'US', 'UK', 'AE', 'GLOBAL'],
  },
  {
    id: 'foursquare',
    name: 'Foursquare City Guide',
    domain: 'foursquare.com',
    category: 'LOCAL_DIRECTORY',
    priority: 'MEDIUM',
    submitUrl: 'https://location.foursquare.com/',
    whyItMatters: 'Supplies location graph data syndicated to dozens of apps, maps, and navigation ecosystems.',
    markets: ['IN', 'US', 'UK', 'AE', 'GLOBAL'],
  },
];

const MANAGE_PROFILE_URL = 'https://www.google.com/search?q=my+business';
const COPILOT_CACHE_TTL_MS = 30 * 60 * 1000;

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);

function hostOf(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const withProto = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
    return new URL(withProto).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function buildUtmWebsiteUrl(rawDomainOrUrl: string | null | undefined, campaign = 'gbp'): string | null {
  if (!rawDomainOrUrl?.trim()) return null;
  try {
    const withProto = /^https?:\/\//i.test(rawDomainOrUrl.trim())
      ? rawDomainOrUrl.trim()
      : `https://${rawDomainOrUrl.trim()}`;
    const u = new URL(withProto);
    u.searchParams.set('utm_source', 'google');
    u.searchParams.set('utm_medium', 'organic');
    u.searchParams.set('utm_campaign', campaign);
    return u.toString();
  } catch {
    return null;
  }
}

export function buildReviewUrl(placeId: string | null | undefined): string | null {
  if (!placeId?.trim()) return null;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId.trim())}`;
}

export function detectMarket(
  country: string | null | undefined,
  domain: string | null | undefined,
  phone: string | null | undefined,
): CitationMarket {
  const c = (country || '').toLowerCase();
  const d = (domain || '').toLowerCase();
  const p = (phone || '').replace(/\s+/g, '');
  if (c.includes('india') || c === 'in' || d.endsWith('.in') || p.startsWith('+91')) return 'IN';
  if (c.includes('united kingdom') || c === 'uk' || c === 'gb' || d.endsWith('.uk') || p.startsWith('+44')) return 'UK';
  if (c.includes('uae') || c.includes('united arab emirates') || c === 'ae' || d.endsWith('.ae') || p.startsWith('+971')) return 'AE';
  if (c.includes('united states') || c === 'us' || c === 'usa' || p.startsWith('+1')) return 'US';
  return 'GLOBAL';
}

/**
 * Computes a deterministic 0–100 local profile audit strictly from real fields
 * returned by Google Places API (New). Never invents missing fields.
 */
export function computeLocalProfileAudit(
  listing: PlacesListing,
  projectDomain: string | null,
): NonNullable<LocalProfileAudit['audit']> {
  const checks: Array<LocalProfileAuditCheck & { weight: number; earned: number }> = [];

  // 1. Operational status (10 pts)
  const isOperational = !listing.businessStatus || listing.businessStatus === 'OPERATIONAL';
  checks.push({
    id: 'status',
    label: 'Listing operational status',
    status: isOperational ? 'PASS' : 'FAIL',
    value: listing.businessStatus || 'Operational',
    recommendation: isOperational
      ? 'Your listing is live and marked operational on Google Maps.'
      : 'Update your business status in Google Business Profile immediately so customers see you are open.',
    impact: 'HIGH',
    weight: 10,
    earned: isOperational ? 10 : 0,
  });

  // 2. Website URL & domain alignment (15 pts)
  const listingHost = hostOf(listing.website);
  const ownHost = hostOf(projectDomain);
  const hasUtm = Boolean(listing.website && /utm_source=/i.test(listing.website));
  if (!listing.website) {
    checks.push({
      id: 'website',
      label: 'Website link on Google Maps',
      status: 'FAIL',
      value: 'Missing',
      recommendation: 'Add your website URL with UTM tracking parameters in Google Business Profile so Maps clicks appear cleanly in GA4.',
      impact: 'HIGH',
      weight: 15,
      earned: 0,
    });
  } else if (ownHost && listingHost && listingHost !== ownHost) {
    checks.push({
      id: 'website',
      label: 'Website link on Google Maps',
      status: 'WARN',
      value: `${listingHost} (differs from ${ownHost})`,
      recommendation: `Your Google Maps listing points to ${listingHost} instead of ${ownHost}. Align both so local authority flows to your main site.`,
      impact: 'HIGH',
      weight: 15,
      earned: 8,
    });
  } else if (!hasUtm) {
    checks.push({
      id: 'website',
      label: 'Website link on Google Maps',
      status: 'WARN',
      value: `${listingHost || listing.website} (no UTM tag)`,
      recommendation: 'Your website is linked, but adding UTM parameters (?utm_source=google&utm_medium=organic&utm_campaign=gbp) lets GA4 separate Maps visits from Direct traffic.',
      impact: 'MEDIUM',
      weight: 15,
      earned: 12,
    });
  } else {
    checks.push({
      id: 'website',
      label: 'Website link on Google Maps',
      status: 'PASS',
      value: `${listingHost || listing.website} (UTM tracked)`,
      recommendation: 'Website link matches your domain and includes UTM tracking.',
      impact: 'HIGH',
      weight: 15,
      earned: 15,
    });
  }

  // 3. Phone number (10 pts)
  const phone = listing.phone || listing.internationalPhone;
  checks.push({
    id: 'phone',
    label: 'Primary phone number',
    status: phone ? 'PASS' : 'FAIL',
    value: phone || 'Missing',
    recommendation: phone
      ? 'Phone number is listed — keep the exact same number on your website header/footer and directories.'
      : 'Add a direct local phone number on Google Maps so mobile searchers can call in 1 tap.',
    impact: 'HIGH',
    weight: 10,
    earned: phone ? 10 : 0,
  });

  // 4. Opening hours (10 pts)
  const hoursDays = listing.hours?.weekdayDescriptions?.length ?? 0;
  checks.push({
    id: 'hours',
    label: 'Business hours configured',
    status: hoursDays >= 5 ? 'PASS' : hoursDays > 0 ? 'WARN' : 'FAIL',
    value: hoursDays > 0 ? `${hoursDays} days listed` : 'Missing',
    recommendation:
      hoursDays >= 5
        ? 'Opening hours are complete — keep holiday/festival hours updated.'
        : 'Add complete weekly operating hours so Google shows "Open now" during high-intent local searches.',
    impact: 'MEDIUM',
    weight: 10,
    earned: hoursDays >= 5 ? 10 : hoursDays > 0 ? 5 : 0,
  });

  // 5. Category depth (10 pts)
  const categoryCount = (listing.primaryTypeDisplayName ? 1 : 0) + listing.types.filter((t) => t.type !== listing.primaryType).length;
  checks.push({
    id: 'categories',
    label: 'Primary & secondary categories',
    status: categoryCount >= 2 ? 'PASS' : categoryCount === 1 ? 'WARN' : 'FAIL',
    value: listing.primaryTypeDisplayName
      ? `${listing.primaryTypeDisplayName}${categoryCount > 1 ? ` + ${categoryCount - 1} more` : ' only'}`
      : 'Not categorized',
    recommendation:
      categoryCount >= 2
        ? 'Primary and supporting categories are set.'
        : 'Add 2–4 relevant secondary categories in Google Business Profile to rank for more service searches.',
    impact: 'HIGH',
    weight: 10,
    earned: categoryCount >= 2 ? 10 : categoryCount === 1 ? 6 : 0,
  });

  // 6. Photo proof (15 pts)
  const photoCount = listing.photos?.length ?? 0;
  checks.push({
    id: 'photos',
    label: 'Listing photo gallery',
    status: photoCount >= 8 ? 'PASS' : photoCount >= 3 ? 'WARN' : 'FAIL',
    value: `${photoCount} public photo${photoCount === 1 ? '' : 's'} shown`,
    recommendation:
      photoCount >= 8
        ? 'Strong visual proof — continue uploading 2–4 fresh product/team photos monthly.'
        : 'Upload at least 10 authentic photos (products, packaging, storefront/delivery, team) — listings with rich photos earn higher Maps clicks.',
    impact: 'MEDIUM',
    weight: 15,
    earned: photoCount >= 8 ? 15 : photoCount >= 3 ? 9 : photoCount > 0 ? 4 : 0,
  });

  // 7. Rating quality (15 pts)
  const rating = listing.rating;
  checks.push({
    id: 'rating',
    label: 'Google star rating',
    status: rating != null && rating >= 4.5 ? 'PASS' : rating != null && rating >= 4.0 ? 'WARN' : 'FAIL',
    value: rating != null ? `${rating.toFixed(1)} ★` : 'No rating yet',
    recommendation:
      rating != null && rating >= 4.5
        ? 'Strong star rating (4.5★+) — keep replying promptly to every review to sustain trust.'
        : 'Focus on delighting repeat customers and proactively requesting reviews from satisfied buyers to lift rating above 4.5★.',
    impact: 'HIGH',
    weight: 15,
    earned: rating == null ? 0 : rating >= 4.5 ? 15 : rating >= 4.0 ? 10 : 5,
  });

  // 8. Review volume (15 pts)
  const reviews = listing.userRatingCount ?? 0;
  checks.push({
    id: 'reviews',
    label: 'Total review volume',
    status: reviews >= 50 ? 'PASS' : reviews >= 15 ? 'WARN' : 'FAIL',
    value: `${reviews} review${reviews === 1 ? '' : 's'}`,
    recommendation:
      reviews >= 50
        ? 'Healthy review base — encourage new reviewers to mention the product/service and their neighborhood.'
        : 'Use the Review Growth Kit (1-tap review link + QR poster + WhatsApp follow-up) to reach 50+ authentic local reviews.',
    impact: 'HIGH',
    weight: 15,
    earned: reviews >= 50 ? 15 : reviews >= 15 ? 9 : reviews > 0 ? 4 : 0,
  });

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const totalEarned = checks.reduce((sum, c) => sum + c.earned, 0);
  const score = totalWeight > 0 ? Math.round((totalEarned / totalWeight) * 100) : 0;
  const passedCount = checks.filter((c) => c.status === 'PASS').length;

  return {
    score,
    passedCount,
    totalChecks: checks.length,
    checks: checks.map(({ weight: _w, earned: _e, ...rest }) => rest),
  };
}

@Injectable()
export class LocalOffpageService {
  private readonly logger = new Logger(LocalOffpageService.name);
  private readonly copilotCache = new Map<string, { value: LocalCopilotPack; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly placesListing: PlacesListingService,
    private readonly router: MultiAiRouterService,
    @Optional() private readonly reportContext?: UnifiedReportContextService,
  ) {}

  async getProfileAudit(projectId: string, forceRefresh = false): Promise<LocalProfileAudit> {
    const [snapshot, businessContext] = await Promise.all([
      forceRefresh ? this.placesListing.refreshOnce(projectId) : this.placesListing.snapshot(projectId),
      this.reportContext ? this.reportContext.buildForProject(projectId) : Promise.resolve(null),
    ]);

    const placeId = snapshot.placeId;
    const listing = snapshot.listing;
    const suggestedQuery =
      snapshot.suggestedQuery ||
      [businessContext?.businessName, businessContext?.primaryCity].filter(Boolean).join(' ').trim() ||
      null;

    const domainForUtm = listing?.website || businessContext?.domain || null;

    return {
      state: snapshot.state,
      placeId,
      fetchedAt: snapshot.fetchedAt ? snapshot.fetchedAt.toISOString() : null,
      error: snapshot.error,
      suggestedQuery,
      listing,
      links: {
        reviewUrl: buildReviewUrl(placeId),
        mapsUrl:
          listing?.googleMapsUri ||
          (placeId ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}` : null),
        manageProfileUrl: MANAGE_PROFILE_URL,
        utmWebsiteUrl: buildUtmWebsiteUrl(domainForUtm, 'gbp'),
      },
      audit: listing ? computeLocalProfileAudit(listing, businessContext?.domain ?? null) : null,
      businessContext,
    };
  }

  async getCitationsAudit(projectId: string): Promise<LocalCitationsAudit> {
    const [profileAudit, backlinkSources] = await Promise.all([
      this.getProfileAudit(projectId, false),
      this.prisma.backlinkSource?.findMany
        ? this.prisma.backlinkSource
            .findMany({
              where: { projectId },
              select: { sourceUrl: true, status: true },
              take: 500,
            })
            .catch(() => [] as Array<{ sourceUrl: string; status: string }>)
        : Promise.resolve([] as Array<{ sourceUrl: string; status: string }>),
    ]);

    const listing = profileAudit.listing;
    const ctx = profileAudit.businessContext;
    const market = detectMarket(ctx?.country, ctx?.domain, listing?.internationalPhone || listing?.phone);
    const industryCorpus = [ctx?.industry, ctx?.summary, ...(ctx?.offerings ?? []), listing?.primaryTypeDisplayName]
      .filter(Boolean)
      .join(' ');

    // Index real discovered backlink source hosts -> first observed URL
    const hostToUrl = new Map<string, string>();
    for (const src of backlinkSources) {
      const h = hostOf(src.sourceUrl);
      if (h && !hostToUrl.has(h)) hostToUrl.set(h, src.sourceUrl);
    }

    const applicable = DIRECTORY_CATALOG.filter((item) => {
      if (!item.markets.includes(market) && !item.markets.includes('GLOBAL')) return false;
      if (item.industryMatch && industryCorpus && !item.industryMatch.test(industryCorpus)) return false;
      if (item.industryMatch && !industryCorpus) return false;
      return true;
    });

    const directories: LocalDirectoryEntry[] = applicable.map((item) => {
      if (item.id === 'google-business-profile' && profileAudit.placeId) {
        return {
          id: item.id,
          name: item.name,
          domain: item.domain,
          category: item.category,
          priority: item.priority,
          status: 'CONNECTED',
          detectedUrl: profileAudit.links.mapsUrl,
          submitUrl: item.submitUrl,
          whyItMatters: item.whyItMatters,
        };
      }

      const candidateDomains = [item.domain, ...(item.aliases ?? [])];
      let matchedUrl: string | null = null;
      for (const [host, url] of hostToUrl.entries()) {
        if (candidateDomains.some((d) => host === d || host.endsWith(`.${d}`))) {
          matchedUrl = url;
          break;
        }
      }

      return {
        id: item.id,
        name: item.name,
        domain: item.domain,
        category: item.category,
        priority: item.priority,
        status: matchedUrl ? 'DETECTED_IN_BACKLINKS' : 'NOT_DETECTED',
        detectedUrl: matchedUrl,
        submitUrl: item.submitUrl,
        whyItMatters: item.whyItMatters,
      };
    });

    const businessName = listing?.name || ctx?.businessName || 'Your Business';
    const address = listing?.address || ctx?.localPresence?.address || [ctx?.primaryCity, ctx?.state, ctx?.country].filter(Boolean).join(', ') || null;
    const phone = listing?.phone || listing?.internationalPhone || null;
    const website = listing?.website || (ctx?.domain ? `https://${ctx.domain}` : null);
    const utmWebsite = buildUtmWebsiteUrl(website, 'local_directory');

    const napLines = [
      `Business Name: ${businessName}`,
      ...(address ? [`Address: ${address}`] : []),
      ...(phone ? [`Phone: ${phone}`] : []),
      ...(website ? [`Website: ${website}`] : []),
    ];

    const coveredCount = directories.filter((d) => d.status !== 'NOT_DETECTED').length;
    const missingCount = directories.length - coveredCount;
    const highPriorityMissing = directories.filter((d) => d.status === 'NOT_DETECTED' && d.priority === 'HIGH').length;

    return {
      market,
      canonicalNap: {
        businessName,
        address,
        phone,
        website,
        utmWebsite,
        formattedBlock: napLines.join('\n'),
      },
      summary: {
        totalDirectories: directories.length,
        coveredCount,
        missingCount,
        highPriorityMissing,
        backlinkSourcesScanned: backlinkSources.length,
      },
      directories,
    };
  }

  async generateCopilotPack(
    projectId: string,
    options?: { forceRefresh?: boolean; organizationId?: string },
  ): Promise<LocalCopilotPack> {
    const [profileAudit, projectMeta] = await Promise.all([
      this.getProfileAudit(projectId, false),
      this.prisma.project
        ?.findUnique({ where: { id: projectId }, select: { organizationId: true } })
        .catch(() => null),
    ]);

    const organizationId = options?.organizationId || projectMeta?.organizationId;
    const cacheKey = `${projectId}::${profileAudit.placeId ?? 'none'}::${profileAudit.fetchedAt ?? 'none'}`;

    if (!options?.forceRefresh) {
      const hit = this.copilotCache.get(cacheKey);
      if (hit && Date.now() < hit.expiresAt) return hit.value;
    }

    const listing = profileAudit.listing;
    const ctx = profileAudit.businessContext;
    const utmUrl = profileAudit.links.utmWebsiteUrl || (ctx?.domain ? `https://${ctx.domain}` : '');
    const reviewUrl = profileAudit.links.reviewUrl;
    const reviewsList = (listing?.reviews ?? []).slice(0, 5);

    const prompt = `You are a Local Off-Page SEO & Google Business Profile specialist helping a business owner optimize their Google Maps presence without needing API write access.
${formatBusinessContextForPrompt(ctx)}
CONNECTED GOOGLE MAPS LISTING FACTS
  name: ${listing?.name || ctx?.businessName || 'Unknown'}
  address: ${listing?.address || ctx?.localPresence?.address || 'not set'}
  rating: ${listing?.rating != null ? `${listing.rating}★` : 'not measured'} (${listing?.userRatingCount ?? 'not measured'} reviews)
  primary category: ${listing?.primaryTypeDisplayName || 'not set'}
  other categories: ${listing?.types?.map((t) => t.displayName).join(', ') || 'none'}
  website with UTM for posts: ${utmUrl || 'use business homepage'}
  direct review link: ${reviewUrl || 'ask customer to search business name on Google Maps'}

RECENT PUBLIC GOOGLE REVIEWS TO DRAFT REPLIES FOR
${
  reviewsList.length > 0
    ? reviewsList
        .map(
          (r, idx) =>
            `  ${idx + 1}. reviewName="${r.name}" | author="${r.authorName}" | rating=${r.rating ?? '?'}★ | text="${(r.text || '(star rating only)').slice(0, 300)}"`,
        )
        .join('\n')
    : '  none available yet'
}

Return valid JSON in this exact shape:
{
  "businessDescription": "Ready-to-paste Google Business Profile description (500-730 chars) naturally weaving in real products, primary city, served neighborhoods, and verifiable proof signals — no keyword stuffing or fake claims.",
  "categorySuggestions": ["Exact Google Business Profile primary/secondary category 1", "Category 2", "Category 3"],
  "weeklyPosts": [
    {
      "title": "Short post headline",
      "postType": "UPDATE",
      "body": "Engaging 80-140 word Google Business Profile update post tailored to this business, its real offerings, and its city/neighborhoods.",
      "ctaLabel": "Order Online | Learn More | Call Now | Book",
      "ctaUrl": "${utmUrl || 'https://your-domain.com'}",
      "photoTip": "Specific authentic photo the owner should snap on their phone and upload with this post"
    },
    {
      "title": "Second weekly post (Offer / Trust / Neighborhood highlight)",
      "postType": "OFFER",
      "body": "...",
      "ctaLabel": "...",
      "ctaUrl": "${utmUrl || 'https://your-domain.com'}",
      "photoTip": "..."
    }
  ],
  "qnaPairs": [
    { "question": "Real buyer question locals ask before ordering/visiting", "answer": "Crisp 40-70 word factual answer mentioning business name, offering, and area" }
  ],
  "reviewReplies": [
    { "reviewName": "exact reviewName from above", "authorName": "author name", "suggestedReply": "Warm, specific owner reply thanking the reviewer (or resolving concerns politely) and naturally mentioning the offering & city." }
  ],
  "whatsappReviewRequest": "Short, warm WhatsApp message the owner can send after a happy order/visit containing ${reviewUrl || '[Google Review Link]'} and gently nudging the customer to mention the product and their neighborhood."
}

Rules:
- Provide exactly 2 weeklyPosts, 5 qnaPairs, 3-5 categorySuggestions, and 1 reviewReply for every public review listed above (empty array if no reviews were listed).
- Use ONLY real business facts given above. Never invent discounts, certifications, awards, or locations not supported by the business context.`;

    try {
      const completion = await this.router.generate({
        prompt,
        systemInstruction:
          'You are a practical local SEO copywriter writing ready-to-paste Google Business Profile assets for a business owner. ' +
          'Write naturally, avoid jargon, never invent facts or fake offers, and reply with valid JSON only.',
        task: AiTask.SEO_ANALYSIS,
        provider: AiProvider.GEMINI,
        model: 'gemini-3.1-flash-lite',
        allowFallback: false,
        organizationId,
        projectId,
        maxTokens: 4500,
        cacheable: !options?.forceRefresh,
      });

      if (completion.refused || !completion.text.trim()) {
        return {
          status: 'ERROR',
          generatedAt: new Date().toISOString(),
          model: completion.model,
          error: 'AI returned no response. Please try again.',
          businessDescription: '',
          categorySuggestions: [],
          weeklyPosts: [],
          qnaPairs: [],
          reviewReplies: [],
          whatsappReviewRequest: '',
          manageProfileUrl: MANAGE_PROFILE_URL,
          reviewUrl,
        };
      }

      const raw = extractAndParseJson(completion.text) as Record<string, unknown>;
      const reviewByName = new Map(reviewsList.map((r) => [r.name, r]));

      const result: LocalCopilotPack = {
        status: 'READY',
        generatedAt: new Date().toISOString(),
        model: completion.model,
        error: null,
        businessDescription: str(raw?.businessDescription),
        categorySuggestions: arr(raw?.categorySuggestions)
          .map((x) => str(x))
          .filter(Boolean)
          .slice(0, 6),
        weeklyPosts: arr(raw?.weeklyPosts)
          .map((p): LocalCopilotPost => ({
            title: str(p?.title, 'Weekly Google Update'),
            postType: str(p?.postType).toUpperCase() === 'OFFER' ? 'OFFER' : 'UPDATE',
            body: str(p?.body),
            ctaLabel: str(p?.ctaLabel, 'Learn More'),
            ctaUrl: str(p?.ctaUrl, utmUrl),
            photoTip: str(p?.photoTip),
          }))
          .filter((p) => p.body)
          .slice(0, 4),
        qnaPairs: arr(raw?.qnaPairs)
          .map((q): LocalCopilotQna => ({
            question: str(q?.question),
            answer: str(q?.answer),
          }))
          .filter((q) => q.question && q.answer)
          .slice(0, 6),
        reviewReplies: arr(raw?.reviewReplies)
          .map((r): LocalCopilotReviewReply => {
            const matched = reviewByName.get(str(r?.reviewName));
            return {
              reviewName: str(r?.reviewName),
              authorName: str(r?.authorName, matched?.authorName || 'Customer'),
              rating: matched?.rating ?? null,
              originalText: matched?.text ?? null,
              suggestedReply: str(r?.suggestedReply),
            };
          })
          .filter((r) => r.suggestedReply)
          .slice(0, 5),
        whatsappReviewRequest: str(raw?.whatsappReviewRequest),
        manageProfileUrl: MANAGE_PROFILE_URL,
        reviewUrl,
      };

      if (this.copilotCache.size >= 200) {
        const oldest = this.copilotCache.keys().next().value;
        if (oldest) this.copilotCache.delete(oldest);
      }
      this.copilotCache.set(cacheKey, { value: result, expiresAt: Date.now() + COPILOT_CACHE_TTL_MS });
      return result;
    } catch (err) {
      this.logger.warn(`[${projectId}] Local Co-Pilot generation failed: ${(err as Error).message}`);
      return {
        status: 'ERROR',
        generatedAt: new Date().toISOString(),
        model: null,
        error: `Could not generate Local Co-Pilot pack: ${(err as Error).message}`.slice(0, 350),
        businessDescription: '',
        categorySuggestions: [],
        weeklyPosts: [],
        qnaPairs: [],
        reviewReplies: [],
        whatsappReviewRequest: '',
        manageProfileUrl: MANAGE_PROFILE_URL,
        reviewUrl,
      };
    }
  }
}
