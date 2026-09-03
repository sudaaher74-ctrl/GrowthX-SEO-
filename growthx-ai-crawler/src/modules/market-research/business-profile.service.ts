import { Injectable, Logger, Optional } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { PrismaService } from '../../database/prisma.service';
import { ModelRole, ModelRouterService } from './model-router.service';
import { parseModelJson } from '../ai-engine/utils/json-extractor.util';
import { normalizeDomain } from '../ai-visibility/citation/citation-detector';

export type MarketScopeRegion = 'worldwide' | 'india' | 'maharashtra';

/**
 * What this client actually sells, read off their own website.
 *
 * Market Research used to open with an empty niche picker: the operator had to
 * tell the product what business they were in before it would look at anything.
 * That is a question the site already answers — the homepage says "mango pulp
 * exporter, Nashik" in its title tag — so the picker was asking the user to
 * retype what we had already crawled. This profile is that answer, resolved
 * once per project and reused, and the picker is now only an override.
 */
export interface DetectedBusinessProfile {
  /** Registered/site domain the profile was read from. */
  domain: string;
  businessName: string;
  /** The niche in the client's own words, specific enough to search on. */
  industry: string;
  /** Short sentence describing what they sell and to whom. */
  summary: string;
  /** Concrete products or services named on the site. */
  offerings: string[];
  /** "B2B", "B2C", "B2B2C", "Marketplace", "Agency", or "" when unclear. */
  businessModel: string;
  city: string;
  state: string;
  country: string;
  /** The competitor search scope this location implies. */
  suggestedRegion: MarketScopeRegion;
  /** Search phrases the client's own customers would use. */
  seedKeywords: string[];
  confidence: 'high' | 'medium' | 'low';
  /** Where each fact came from, so a wrong profile is debuggable. */
  signals: string[];
  /** How the profile was produced. */
  source: 'ai' | 'heuristic';
  detectedAt: string;
}

interface SiteEvidence {
  domain: string;
  title: string;
  description: string;
  jsonLdName: string;
  jsonLdDescription: string;
  jsonLdType: string;
  address: { city: string; state: string; country: string };
  headings: string[];
  bodyText: string;
  pagesRead: string[];
}

/** Pages worth reading beyond the homepage, in the order we try them. */
const CONTEXT_PATHS = ['/about', '/about-us', '/products', '/services', '/what-we-do'];

const MAHARASHTRA_CITIES = [
  'mumbai',
  'pune',
  'nashik',
  'nagpur',
  'jalgaon',
  'aurangabad',
  'chhatrapati sambhajinagar',
  'kolhapur',
  'solapur',
  'thane',
  'navi mumbai',
  'sangli',
  'satara',
  'ahmednagar',
  'ratnagiri',
  'amravati',
  'latur',
  'nanded',
  'akola',
  'dhule',
  'chiplun',
  'baramati',
];

const INDIA_CITIES = [
  'delhi',
  'new delhi',
  'bengaluru',
  'bangalore',
  'hyderabad',
  'chennai',
  'kolkata',
  'ahmedabad',
  'surat',
  'jaipur',
  'lucknow',
  'indore',
  'chandigarh',
  'kochi',
  'coimbatore',
  'noida',
  'gurugram',
  'gurgaon',
];

/**
 * Niche rules, most specific first. Each entry needs one `any` hit and no
 * `not` hit, so "food delivery app" does not read as a food processor.
 */
const NICHE_RULES: Array<{ any: string[]; not?: string[]; industry: string; keywords: string[] }> = [
  {
    any: ['fruit pulp', 'mango pulp', 'aseptic', 'puree', 'fruit concentrate', 'iqf', 'guava pulp', 'tomato paste'],
    industry: 'Fruit Pulp, Purees, Concentrates & IQF Agro Processing',
    keywords: ['mango pulp exporter', 'aseptic fruit puree supplier', 'iqf frozen fruit manufacturer'],
  },
  {
    any: ['agro export', 'food export', 'spice export', 'agri export', 'apeda', 'food processing', 'dehydrated'],
    industry: 'Agro & Processed Food Manufacturing and Exports',
    keywords: ['agro export company', 'processed food manufacturer', 'bulk food ingredient supplier'],
  },
  {
    any: ['logistics', 'freight', 'cargo', 'transporter', 'trucking', 'fleet', 'warehousing', '3pl', 'supply chain'],
    industry: 'Logistics, Freight & Fleet Transportation Services',
    keywords: ['logistics company', 'freight forwarding services', 'transport and warehousing'],
  },
  {
    any: ['seo', 'digital marketing', 'performance marketing', 'ppc agency', 'branding agency', 'social media agency'],
    industry: 'SEO, Performance Marketing & Digital Growth Agency',
    keywords: ['seo agency', 'digital marketing services', 'performance marketing company'],
  },
  {
    any: ['saas', 'software as a service', 'api platform', 'developer platform', 'cloud platform', 'dashboard software'],
    industry: 'Cloud Software, SaaS & Developer Platforms',
    keywords: ['saas platform', 'cloud software for teams', 'developer api platform'],
  },
  {
    any: ['manufactur', 'fabrication', 'cnc', 'foundry', 'injection moulding', 'industrial equipment', 'machinery'],
    industry: 'Industrial Manufacturing & Engineering Solutions',
    keywords: ['industrial manufacturer', 'precision engineering company', 'machinery supplier'],
  },
  {
    any: ['pharma', 'api manufacturer', 'formulation', 'nutraceutical', 'clinic', 'hospital', 'diagnostics', 'dental'],
    industry: 'Healthcare, Pharma & Clinical Services',
    keywords: ['healthcare provider', 'pharmaceutical manufacturer', 'clinical services'],
  },
  {
    any: ['textile', 'garment', 'apparel', 'fabric', 'yarn', 'knitwear'],
    industry: 'Textiles, Apparel & Garment Manufacturing',
    keywords: ['textile manufacturer', 'garment exporter', 'fabric supplier'],
  },
  {
    any: ['real estate', 'builders', 'developers', 'property', 'construction'],
    industry: 'Real Estate, Construction & Property Development',
    keywords: ['property developer', 'construction company', 'real estate builder'],
  },
  {
    any: ['ecommerce', 'e-commerce', 'online store', 'shop now', 'add to cart', 'free shipping'],
    industry: 'E-Commerce & Direct-to-Consumer Retail',
    keywords: ['online store', 'buy online', 'd2c brand'],
  },
  {
    any: ['law firm', 'advocate', 'legal services', 'chartered accountant', 'consulting firm', 'audit'],
    industry: 'Professional, Legal & Financial Advisory Services',
    keywords: ['professional services firm', 'business advisory', 'consulting services'],
  },
];

/**
 * Reads a client's own website and answers "what business is this?" so the
 * Market Research page can open on their actual market instead of a picker.
 *
 * The detection is cached on the project: the same site is not re-fetched on
 * every page load, and an operator who disagrees can still override the niche
 * by hand, which is stored as the profile and wins from then on.
 */
@Injectable()
export class BusinessProfileService {
  private readonly logger = new Logger(BusinessProfileService.name);

  /** A profile older than this is re-read; sites do change what they sell. */
  private readonly TTL_MS = 30 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly models?: ModelRouterService,
  ) {}

  /**
   * The project's business profile, detected on first call and reused after.
   *
   * `force` re-reads the site — that is what the "Re-detect" control sends
   * when a client's site has been rebuilt and the cached niche is stale.
   */
  async getProfile(
    projectId: string,
    domain: string,
    options?: { force?: boolean; fallbackName?: string },
  ): Promise<DetectedBusinessProfile> {
    const cleanDomain = normalizeDomain(domain);

    if (!options?.force) {
      const cached = await this.readCached(projectId, cleanDomain);
      if (cached) return cached;
    }

    const profile = await this.detect(cleanDomain, options?.fallbackName);
    await this.persist(projectId, profile);
    return profile;
  }

  /** Stores an operator's manual correction as the project's profile. */
  async overrideProfile(
    projectId: string,
    domain: string,
    patch: { industry?: string; businessName?: string; region?: MarketScopeRegion },
  ): Promise<DetectedBusinessProfile> {
    const base = await this.getProfile(projectId, domain);
    const merged: DetectedBusinessProfile = {
      ...base,
      industry: patch.industry?.trim() || base.industry,
      businessName: patch.businessName?.trim() || base.businessName,
      suggestedRegion: patch.region || base.suggestedRegion,
      confidence: 'high',
      signals: [...base.signals, 'Confirmed by operator'],
      detectedAt: new Date().toISOString(),
    };
    await this.persist(projectId, merged);
    return merged;
  }

  private async readCached(projectId: string, domain: string): Promise<DetectedBusinessProfile | null> {
    try {
      // Caught rather than guarded: a deployment running ahead of its migration
      // has no table here, and should fall back to live detection, not 500.
      const row = await this.prisma.projectBusinessProfile.findUnique({ where: { projectId } });
      if (!row) return null;
      if (normalizeDomain(row.domain || '') !== domain) return null;

      const age = Date.now() - new Date(row.detectedAt).getTime();
      if (age > this.TTL_MS) return null;

      return {
        domain: row.domain,
        businessName: row.businessName,
        industry: row.industry,
        summary: row.summary || '',
        offerings: row.offerings || [],
        businessModel: row.businessModel || '',
        city: row.city || '',
        state: row.state || '',
        country: row.country || '',
        suggestedRegion: (row.suggestedRegion || 'worldwide') as MarketScopeRegion,
        seedKeywords: row.seedKeywords || [],
        confidence: (row.confidence || 'medium') as DetectedBusinessProfile['confidence'],
        signals: row.signals || [],
        source: (row.source || 'heuristic') as DetectedBusinessProfile['source'],
        detectedAt: new Date(row.detectedAt).toISOString(),
      };
    } catch (err) {
      this.logger.debug(`Business profile cache read skipped for ${projectId}: ${err}`);
      return null;
    }
  }

  private async persist(projectId: string, profile: DetectedBusinessProfile): Promise<void> {
    const data = {
      domain: profile.domain,
      businessName: profile.businessName,
      industry: profile.industry,
      summary: profile.summary,
      offerings: profile.offerings,
      businessModel: profile.businessModel,
      city: profile.city,
      state: profile.state,
      country: profile.country,
      suggestedRegion: profile.suggestedRegion,
      seedKeywords: profile.seedKeywords,
      confidence: profile.confidence,
      signals: profile.signals,
      source: profile.source,
      detectedAt: new Date(profile.detectedAt),
    };

    try {
      await this.prisma.projectBusinessProfile.upsert({
        where: { projectId },
        update: data,
        create: { projectId, ...data },
      });
    } catch (err) {
      this.logger.warn(`Could not persist business profile for ${projectId}: ${err}`);
    }
  }

  /** Reads the site, then asks the model to name the business; heuristics if it can't. */
  async detect(domain: string, fallbackName?: string): Promise<DetectedBusinessProfile> {
    const evidence = await this.readSite(domain);

    if (this.models?.isConfigured()) {
      const fromModel = await this.classifyWithModel(evidence, fallbackName);
      if (fromModel) return fromModel;
    }

    return this.classifyHeuristically(evidence, fallbackName);
  }

  /** Fetches the homepage plus whichever context page answers first. */
  private async readSite(domain: string): Promise<SiteEvidence> {
    const evidence: SiteEvidence = {
      domain,
      title: '',
      description: '',
      jsonLdName: '',
      jsonLdDescription: '',
      jsonLdType: '',
      address: { city: '', state: '', country: '' },
      headings: [],
      bodyText: '',
      pagesRead: [],
    };

    const home = await this.fetchHtml([`https://${domain}`, `http://${domain}`]);
    if (!home) return evidence;

    this.absorb(evidence, home.html, home.url);

    // One extra page is enough context to separate "we sell X" from a slogan.
    // Capped at two probes: detection runs inside a page load, and a site that
    // 404s every guessed path must not cost five timeouts to find that out.
    let probes = 0;
    for (const path of CONTEXT_PATHS) {
      if (evidence.bodyText.length > 2500 || probes >= 2) break;
      probes += 1;
      const extra = await this.fetchHtml([`https://${domain}${path}`]);
      if (extra) {
        this.absorb(evidence, extra.html, extra.url);
        break;
      }
    }

    return evidence;
  }

  private async fetchHtml(urls: string[]): Promise<{ url: string; html: string } | null> {
    for (const url of urls) {
      try {
        const res = await axios.get(url, {
          timeout: 5000,
          maxRedirects: 4,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
              'Chrome/124.0.0.0 Safari/537.36 GrowthX-MarketBot/1.0',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          validateStatus: (status) => status < 400,
        });
        const html = typeof res.data === 'string' ? res.data : '';
        if (html) return { url, html };
      } catch (err) {
        this.logger.debug(`Site read failed for ${url}: ${err}`);
      }
    }
    return null;
  }

  private absorb(evidence: SiteEvidence, html: string, url: string): void {
    const $ = cheerio.load(html);
    evidence.pagesRead.push(url);

    if (!evidence.title) {
      evidence.title =
        $('title').first().text().trim() || $('meta[property="og:title"]').attr('content')?.trim() || '';
    }
    if (!evidence.description) {
      evidence.description =
        $('meta[name="description"]').attr('content')?.trim() ||
        $('meta[property="og:description"]').attr('content')?.trim() ||
        '';
    }

    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = $(el).html() || '';
        const parsed = JSON.parse(raw);
        for (const node of this.flattenJsonLd(parsed)) {
          if (!evidence.jsonLdName && typeof node.name === 'string') evidence.jsonLdName = node.name;
          if (!evidence.jsonLdDescription && typeof node.description === 'string') {
            evidence.jsonLdDescription = node.description;
          }
          if (!evidence.jsonLdType && typeof node['@type'] === 'string') evidence.jsonLdType = node['@type'];

          const address = node.address;
          if (address && typeof address === 'object') {
            evidence.address.city ||= String(address.addressLocality || '').trim();
            evidence.address.state ||= String(address.addressRegion || '').trim();
            evidence.address.country ||= String(address.addressCountry || '').trim();
          }
        }
      } catch {
        // A malformed JSON-LD block is common and never worth failing detection over.
      }
    });

    $('h1, h2').each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text && text.length < 160 && evidence.headings.length < 16) evidence.headings.push(text);
    });

    $('script, style, noscript, svg').remove();
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    evidence.bodyText = `${evidence.bodyText} ${text}`.trim().slice(0, 6000);
  }

  /** JSON-LD is published as an object, an array, or an @graph; flatten all three. */
  private flattenJsonLd(node: any): any[] {
    if (!node) return [];
    if (Array.isArray(node)) return node.flatMap((n) => this.flattenJsonLd(n));
    if (typeof node !== 'object') return [];
    const graph = Array.isArray(node['@graph']) ? node['@graph'].flatMap((n: any) => this.flattenJsonLd(n)) : [];
    return [node, ...graph];
  }

  private async classifyWithModel(
    evidence: SiteEvidence,
    fallbackName?: string,
  ): Promise<DetectedBusinessProfile | null> {
    const input = [
      `Website: ${evidence.domain}`,
      evidence.title ? `Page title: ${evidence.title}` : '',
      evidence.description ? `Meta description: ${evidence.description}` : '',
      evidence.jsonLdName ? `Schema.org organisation name: ${evidence.jsonLdName}` : '',
      evidence.jsonLdDescription ? `Schema.org description: ${evidence.jsonLdDescription}` : '',
      evidence.address.city || evidence.address.state || evidence.address.country
        ? `Schema.org address: ${[evidence.address.city, evidence.address.state, evidence.address.country].filter(Boolean).join(', ')}`
        : '',
      evidence.headings.length ? `Headings: ${evidence.headings.join(' | ')}` : '',
      evidence.bodyText ? `Page text: ${evidence.bodyText.slice(0, 3500)}` : '',
      '',
      'Read the site above and state what this business actually sells.',
      'Rules:',
      '1. Use only what the site says. Do not invent products, cities, or claims that are not in the text.',
      '2. `industry` must be the specific niche a buyer would search for (e.g. "Aseptic mango pulp and IQF fruit processing for bulk export"), not a broad label like "Digital Services".',
      '3. `city`, `state`, `country` come from the address, contact details, or "based in" copy. Leave them empty when the site does not say.',
      '4. `seedKeywords` are phrases this business\'s own customers would type into Google.',
      '5. Set confidence to "low" when the page text was thin or ambiguous.',
    ]
      .filter(Boolean)
      .join('\n');

    const schema = {
      name: 'business_profile',
      schema: {
        type: 'object',
        required: ['businessName', 'industry', 'summary', 'city', 'state', 'country', 'confidence'],
        properties: {
          businessName: { type: 'string' },
          industry: { type: 'string' },
          summary: { type: 'string' },
          offerings: { type: 'array', items: { type: 'string' } },
          businessModel: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          country: { type: 'string' },
          seedKeywords: { type: 'array', items: { type: 'string' } },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    };

    try {
      const result = await this.models!.generate({
        step: 'detect_business_profile',
        role: ModelRole.WORKER,
        instructions:
          'You identify what a company sells by reading its own website. ' +
          'You never guess beyond the supplied text. Return only JSON matching the schema.',
        input,
        jsonSchema: schema,
        maxOutputTokens: 900,
      });

      const parsed = parseModelJson<Record<string, any>>(result.text, 'Business profile');
      const industry = String(parsed?.industry || '').trim();
      if (!industry) return null;

      const city = String(parsed.city || evidence.address.city || '').trim();
      const state = String(parsed.state || evidence.address.state || '').trim();
      const country = String(parsed.country || evidence.address.country || '').trim();

      return {
        domain: evidence.domain,
        businessName:
          String(parsed.businessName || '').trim() ||
          evidence.jsonLdName ||
          fallbackName ||
          this.brandFromDomain(evidence.domain),
        industry,
        summary: String(parsed.summary || '').trim(),
        offerings: this.stringList(parsed.offerings, 8),
        businessModel: String(parsed.businessModel || '').trim(),
        city,
        state,
        country,
        suggestedRegion: this.regionFor(city, state, country, evidence),
        seedKeywords: this.stringList(parsed.seedKeywords, 8),
        confidence: (['high', 'medium', 'low'] as const).includes(parsed.confidence)
          ? parsed.confidence
          : 'medium',
        signals: this.signalsFor(evidence),
        source: 'ai',
        detectedAt: new Date().toISOString(),
      };
    } catch (err) {
      this.logger.warn(`Model business detection failed for ${evidence.domain}: ${err}`);
      return null;
    }
  }

  private classifyHeuristically(evidence: SiteEvidence, fallbackName?: string): DetectedBusinessProfile {
    const haystack = [
      evidence.title,
      evidence.description,
      evidence.jsonLdDescription,
      evidence.headings.join(' '),
      evidence.bodyText,
      evidence.domain,
    ]
      .join(' ')
      .toLowerCase();

    const matched = NICHE_RULES.find(
      (rule) =>
        rule.any.some((token) => haystack.includes(token)) &&
        !(rule.not || []).some((token) => haystack.includes(token)),
    );

    const city =
      evidence.address.city || MAHARASHTRA_CITIES.concat(INDIA_CITIES).find((c) => haystack.includes(c)) || '';
    const state = evidence.address.state || (MAHARASHTRA_CITIES.includes(city) ? 'Maharashtra' : '');
    const country =
      evidence.address.country ||
      (state || INDIA_CITIES.includes(city) || evidence.domain.endsWith('.in') ? 'India' : '');

    const industry = matched?.industry || this.industryFromText(evidence);
    const hasEvidence = Boolean(evidence.title || evidence.description || evidence.bodyText);

    return {
      domain: evidence.domain,
      businessName: evidence.jsonLdName || fallbackName || this.brandFromDomain(evidence.domain),
      industry,
      summary: evidence.description || evidence.jsonLdDescription || '',
      offerings: evidence.headings.slice(0, 5),
      businessModel: '',
      city: this.titleCase(city),
      state: this.titleCase(state),
      country: this.titleCase(country),
      suggestedRegion: this.regionFor(city, state, country, evidence),
      seedKeywords: matched?.keywords || [],
      confidence: matched && hasEvidence ? 'medium' : 'low',
      signals: this.signalsFor(evidence),
      source: 'heuristic',
      detectedAt: new Date().toISOString(),
    };
  }

  /**
   * Last-resort niche when no rule matched: name the business from its own
   * title rather than falling back to "Digital Products & Market Services",
   * which matched every site and therefore described none of them.
   */
  private industryFromText(evidence: SiteEvidence): string {
    const source = evidence.title || evidence.headings[0] || evidence.description || '';
    const cleaned = source
      .split(/[|–—\-·:]/)
      .map((part) => part.trim())
      .filter((part) => part.length > 3 && !/^home$/i.test(part))
      .sort((a, b) => b.length - a.length)[0];

    if (cleaned) return cleaned.slice(0, 120);
    return `${this.brandFromDomain(evidence.domain)} — market category not yet detected`;
  }

  private regionFor(city: string, state: string, country: string, evidence: SiteEvidence): MarketScopeRegion {
    const lower = `${city} ${state} ${country}`.toLowerCase();
    if (lower.includes('maharashtra') || MAHARASHTRA_CITIES.some((c) => lower.includes(c))) return 'maharashtra';
    if (lower.includes('india') || INDIA_CITIES.some((c) => lower.includes(c))) return 'india';
    if (!lower.trim() && evidence.domain.endsWith('.in')) return 'india';
    return 'worldwide';
  }

  private signalsFor(evidence: SiteEvidence): string[] {
    const signals: string[] = [];
    if (evidence.pagesRead.length) signals.push(`Read ${evidence.pagesRead.length} page(s): ${evidence.pagesRead.join(', ')}`);
    if (evidence.title) signals.push(`Title: ${evidence.title.slice(0, 120)}`);
    if (evidence.jsonLdType) signals.push(`Schema.org type: ${evidence.jsonLdType}`);
    if (evidence.address.city || evidence.address.state) {
      signals.push(`Address on site: ${[evidence.address.city, evidence.address.state, evidence.address.country].filter(Boolean).join(', ')}`);
    }
    if (!evidence.pagesRead.length) signals.push('Website could not be reached; profile inferred from the domain alone');
    return signals;
  }

  private stringList(raw: unknown, max: number): string[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item) => String(item ?? '').trim())
      .filter((item) => item.length > 1)
      .slice(0, max);
  }

  private brandFromDomain(domain: string): string {
    const raw = (domain || '').split('.')[0] || 'Brand';
    return raw.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private titleCase(value: string): string {
    if (!value) return '';
    return value.replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
