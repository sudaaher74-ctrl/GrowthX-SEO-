import { PrismaService } from '../../database/prisma.service';

export interface SearchMarket {
  /** Country name Google results are localised to, e.g. "India". */
  country: string;
  language: string;
  /** Where the country came from, so the screen can say. */
  source: 'SET' | 'SEARCH_CONSOLE' | 'DEFAULT';
}

/**
 * Search Console reports countries as ISO 3166 alpha-3 codes ("ind"); Google
 * results are asked for by country name. The markets this product's customers
 * sell into, not every country.
 */
const COUNTRY_BY_ALPHA3: Record<string, string> = {
  ind: 'India',
  usa: 'United States',
  gbr: 'United Kingdom',
  can: 'Canada',
  aus: 'Australia',
  nzl: 'New Zealand',
  are: 'United Arab Emirates',
  sau: 'Saudi Arabia',
  qat: 'Qatar',
  kwt: 'Kuwait',
  omn: 'Oman',
  bhr: 'Bahrain',
  sgp: 'Singapore',
  mys: 'Malaysia',
  idn: 'Indonesia',
  phl: 'Philippines',
  tha: 'Thailand',
  vnm: 'Vietnam',
  bgd: 'Bangladesh',
  npl: 'Nepal',
  lka: 'Sri Lanka',
  pak: 'Pakistan',
  zaf: 'South Africa',
  nga: 'Nigeria',
  ken: 'Kenya',
  egy: 'Egypt',
  deu: 'Germany',
  fra: 'France',
  esp: 'Spain',
  ita: 'Italy',
  nld: 'Netherlands',
  bel: 'Belgium',
  che: 'Switzerland',
  swe: 'Sweden',
  irl: 'Ireland',
  pol: 'Poland',
  prt: 'Portugal',
  bra: 'Brazil',
  mex: 'Mexico',
  jpn: 'Japan',
  kor: 'South Korea',
  hkg: 'Hong Kong',
};

export const DEFAULT_COUNTRY = 'India';

export function countryFromAlpha3(code: string | null | undefined): string | null {
  if (!code) return null;
  return COUNTRY_BY_ALPHA3[code.trim().toLowerCase()] ?? null;
}

/**
 * The Google market to check: the one set on the project, else the country
 * sending the most Search Console clicks over 90 days, else India — and which
 * of the three it was.
 */
export async function resolveMarket(prisma: PrismaService, projectId: string): Promise<SearchMarket> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { searchCountry: true, searchLanguage: true },
  });
  const language = project?.searchLanguage || 'en';
  if (project?.searchCountry) return { country: project.searchCountry, language, source: 'SET' };

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const top = await prisma.gscDailyMetric.groupBy({
    by: ['country'],
    where: { projectId, grain: 'COUNTRY', date: { gte: since }, country: { not: null } },
    _sum: { clicks: true },
    orderBy: { _sum: { clicks: 'desc' } },
    take: 3,
  });
  for (const row of top) {
    const country = countryFromAlpha3(row.country);
    if (country && (row._sum.clicks ?? 0) > 0) return { country, language, source: 'SEARCH_CONSOLE' };
  }
  return { country: DEFAULT_COUNTRY, language, source: 'DEFAULT' };
}
