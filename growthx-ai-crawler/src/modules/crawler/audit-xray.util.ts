import * as cheerio from 'cheerio';

export interface HtmlSnapshotSummary {
  title: string | null;
  titleCount: number;
  metaDescription: string | null;
  metaDescriptionCount: number;
  h1: string[];
  canonicalUrl: string | null;
  wordCount: number;
  internalLinksCount: number;
}

export function extractHtmlSnapshotSummary(html: string | null | undefined, pageUrl?: string): HtmlSnapshotSummary | null {
  if (!html || !html.trim()) return null;
  const $ = cheerio.load(html);

  const titles: string[] = [];
  $('title').each((_i, el) => {
    const t = $(el).text().trim();
    if (t) titles.push(t);
  });

  const descriptions: string[] = [];
  $('meta[name="description"], meta[name="Description"]').each((_i, el) => {
    const c = $(el).attr('content')?.trim();
    if (c) descriptions.push(c);
  });

  const h1: string[] = [];
  $('h1').each((_i, el) => {
    const t = $(el).text().trim();
    if (t) h1.push(t);
  });

  const canonicals: string[] = [];
  $('link[rel="canonical"]').each((_i, el) => {
    const href = $(el).attr('href')?.trim();
    if (href) canonicals.push(href);
  });

  let host = '';
  try {
    if (pageUrl) host = new URL(pageUrl).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    host = '';
  }

  let internalLinksCount = 0;
  $('a[href]').each((_i, el) => {
    const href = $(el).attr('href')?.trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      return;
    }
    if (href.startsWith('/')) {
      internalLinksCount++;
      return;
    }
    if (host) {
      try {
        const targetHost = new URL(href).hostname.replace(/^www\./i, '').toLowerCase();
        if (targetHost === host) internalLinksCount++;
      } catch {
        // ignore invalid href
      }
    }
  });

  // Compute visible body word count (excluding script/style/noscript/head)
  const clone = cheerio.load(html);
  clone('script, style, noscript, head, svg').remove();
  const bodyText = clone('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = bodyText ? bodyText.split(' ').filter(Boolean).length : 0;

  return {
    title: titles.length > 0 ? titles[titles.length - 1] : null,
    titleCount: titles.length,
    metaDescription: descriptions.length > 0 ? descriptions[descriptions.length - 1] : null,
    metaDescriptionCount: descriptions.length,
    h1,
    canonicalUrl: canonicals.length > 0 ? canonicals[canonicals.length - 1] : null,
    wordCount,
    internalLinksCount,
  };
}

export interface AiBotRuleResult {
  bot: string;
  vendor: string;
  purpose: string;
  status: 'ALLOWED' | 'BLOCKED' | 'UNSPECIFIED';
  matchedRule: string | null;
}

const AI_BOTS: Array<{ bot: string; vendor: string; purpose: string }> = [
  { bot: 'OAI-SearchBot', vendor: 'OpenAI', purpose: 'ChatGPT Search indexing & citations' },
  { bot: 'ChatGPT-User', vendor: 'OpenAI', purpose: 'Live ChatGPT user browsing' },
  { bot: 'GPTBot', vendor: 'OpenAI', purpose: 'OpenAI model training crawler' },
  { bot: 'PerplexityBot', vendor: 'Perplexity', purpose: 'Perplexity AI search & answers' },
  { bot: 'ClaudeBot', vendor: 'Anthropic', purpose: 'Claude search & web retrieval' },
  { bot: 'Google-Extended', vendor: 'Google', purpose: 'Gemini & Google AI grounding' },
  { bot: 'CCBot', vendor: 'Common Crawl', purpose: 'Open web AI dataset' },
];

/**
 * Evaluates root-path (`/`) access for major AI search & LLM bots from robots.txt.
 */
export function parseAiBotsFromRobotsTxt(robotsTxt: string | null): AiBotRuleResult[] {
  if (!robotsTxt || !robotsTxt.trim()) {
    return AI_BOTS.map((b) => ({
      ...b,
      status: 'UNSPECIFIED',
      matchedRule: null,
    }));
  }

  // Parse groups: each group maps lowercase user-agents -> rules
  const groups: Array<{ agents: string[]; rules: Array<{ type: 'allow' | 'disallow'; path: string }> }> = [];
  let current: { agents: string[]; rules: Array<{ type: 'allow' | 'disallow'; path: string }> } | null = null;
  let seenRuleInCurrent = false;

  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const val = line.slice(colon + 1).trim();

    if (key === 'user-agent') {
      if (!current || seenRuleInCurrent) {
        current = { agents: [], rules: [] };
        groups.push(current);
        seenRuleInCurrent = false;
      }
      if (val) current.agents.push(val.toLowerCase());
    } else if ((key === 'disallow' || key === 'allow') && current) {
      seenRuleInCurrent = true;
      current.rules.push({ type: key, path: val });
    }
  }

  const evalRoot = (rules: Array<{ type: 'allow' | 'disallow'; path: string }>): { status: 'ALLOWED' | 'BLOCKED'; rule: string } | null => {
    let best: { type: 'allow' | 'disallow'; path: string } | null = null;
    for (const r of rules) {
      if (r.type === 'disallow' && r.path === '') {
        // `Disallow:` with empty value means allow all
        if (!best) best = { type: 'allow', path: '/' };
        continue;
      }
      if (r.path === '/' || r.path === '/*') {
        if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.type === 'allow')) {
          best = r;
        }
      }
    }
    if (!best) return null;
    return {
      status: best.type === 'disallow' ? 'BLOCKED' : 'ALLOWED',
      rule: `${best.type === 'disallow' ? 'Disallow' : 'Allow'}: ${best.path}`,
    };
  };

  const wildcardRules = groups.filter((g) => g.agents.includes('*')).flatMap((g) => g.rules);
  const wildcardVerdict = evalRoot(wildcardRules);

  return AI_BOTS.map((b) => {
    const specificRules = groups.filter((g) => g.agents.includes(b.bot.toLowerCase())).flatMap((g) => g.rules);
    const specificVerdict = evalRoot(specificRules);
    if (specificVerdict) {
      return {
        ...b,
        status: specificVerdict.status,
        matchedRule: `User-agent: ${b.bot} → ${specificVerdict.rule}`,
      };
    }
    if (wildcardVerdict) {
      return {
        ...b,
        status: wildcardVerdict.status,
        matchedRule: `User-agent: * → ${wildcardVerdict.rule}`,
      };
    }
    return {
      ...b,
      status: 'ALLOWED',
      matchedRule: 'No blocking rule in robots.txt',
    };
  });
}

/**
 * Generates a clean, standards-compliant `/llms.txt` markdown file from crawled indexable pages.
 */
export function generateLlmsTxt(
  domain: string,
  pages: Array<{
    url: string;
    title: string | null;
    metaDescription: string | null;
    pageType: string;
    indexability: string | null;
    statusCode: number;
  }>,
): string {
  const indexable = pages.filter((p) => p.statusCode === 200 && p.indexability !== 'NOT_INDEXABLE');
  const home = indexable.find((p) => {
    try {
      const path = new URL(p.url).pathname;
      return path === '/' || path === '';
    } catch {
      return false;
    }
  });

  const cleanTitle = (p: { title: string | null; url: string }) =>
    (p.title || p.url).replace(/[\r\n]+/g, ' ').trim().slice(0, 90);
  const cleanDesc = (d: string | null) =>
    d ? `: ${d.replace(/[\r\n]+/g, ' ').trim().slice(0, 140)}` : '';

  const moneyTypes = new Set(['HOME', 'PRODUCT', 'SERVICE', 'PRICING', 'LOCATION', 'CATEGORY']);
  const contentTypes = new Set(['BLOG', 'ARTICLE', 'FAQ', 'CASE_STUDY', 'GUIDE']);

  const corePages = indexable.filter((p) => moneyTypes.has((p.pageType || '').toUpperCase())).slice(0, 20);
  const guides = indexable.filter((p) => contentTypes.has((p.pageType || '').toUpperCase())).slice(0, 20);
  const others = indexable
    .filter((p) => !moneyTypes.has((p.pageType || '').toUpperCase()) && !contentTypes.has((p.pageType || '').toUpperCase()))
    .slice(0, 10);

  const lines: string[] = [
    `# ${home?.title?.split(/[|–-]/)[0]?.trim() || domain}`,
    '',
    `> ${home?.metaDescription?.trim() || `Official website and product/service documentation for ${domain}.`}`,
    '',
  ];

  if (corePages.length > 0) {
    lines.push('## Core Pages & Offerings', '');
    for (const p of corePages) {
      lines.push(`- [${cleanTitle(p)}](${p.url})${cleanDesc(p.metaDescription)}`);
    }
    lines.push('');
  }

  if (guides.length > 0) {
    lines.push('## Guides, Articles & FAQs', '');
    for (const p of guides) {
      lines.push(`- [${cleanTitle(p)}](${p.url})${cleanDesc(p.metaDescription)}`);
    }
    lines.push('');
  }

  if (others.length > 0) {
    lines.push('## Additional Resources', '');
    for (const p of others) {
      lines.push(`- [${cleanTitle(p)}](${p.url})${cleanDesc(p.metaDescription)}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}
