import { FIX_CLASS, FixClass } from './fix-class';

export interface IssueCopy {
  title: string; // {n} replaced with affectedCount
  cost: string; // {traffic} replaced with GSC share, or dropped if null
  action: string;
  fixClass: FixClass;
  technical: string; // shown only in Technical details expander
}

export const ISSUE_COPY: Record<string, IssueCopy> = {
  MISSING_TITLE: {
    title: '{n} pages have no name in Google search results',
    cost: 'These pages get {traffic}. Google invents a title from whatever text it finds, and it is usually wrong',
    action:
      "We'll write a clear title for each page using what the page is actually about. This shows in the browser tab and in search results — nothing on the page itself changes. Reversible any time",
    fixClass: FIX_CLASS.MISSING_TITLE ?? 'AUTO',
    technical: 'Missing or empty <title> tag in HTML document head.',
  },
  LONG_TITLE: {
    title: '{n} page titles get cut off halfway in Google',
    cost: 'Shoppers see "Fresh Organic Tomatoes — Best Quality Whole…" and can\'t tell what you sell. These pages get {traffic}',
    action:
      "We'll shorten each title to fit, keeping the important words at the front. Your page content doesn't change",
    fixClass: FIX_CLASS.LONG_TITLE ?? 'AUTO',
    technical: 'Title tag exceeds recommended pixel length (typically > 60 characters).',
  },
  SHORT_TITLE: {
    title: '{n} page titles are too short to tell Google what the page is',
    cost: "A two-word title competes badly against a competitor's descriptive one. These pages get {traffic}",
    action: "We'll expand each title with what the page actually covers. Nothing on the page changes",
    fixClass: FIX_CLASS.SHORT_TITLE ?? 'AUTO',
    technical: 'Title tag is unusually brief (< 10 characters or under 3 words).',
  },
  DUPLICATE_TITLE: {
    title: '{n} pages share the same name in search results',
    cost: "Google can't tell these pages apart and often shows only one of them, so the rest never appear",
    action: "We'll make each title specific to its own page. Page content is untouched",
    fixClass: FIX_CLASS.DUPLICATE_TITLE ?? 'AUTO',
    technical: 'Identical title tags found across multiple distinct URLs.',
  },
  MISSING_META_DESCRIPTION: {
    title: '{n} pages let Google write their own description — usually badly',
    cost: 'The grey text under your link in search results is your sales pitch. Right now Google picks a random sentence. These pages get {traffic}',
    action:
      "We'll write a short description for each page that says what's on it and why to click. Invisible on your site, visible in Google",
    fixClass: FIX_CLASS.MISSING_META_DESCRIPTION ?? 'AUTO',
    technical: 'Missing meta description tag in document head.',
  },
  LONG_META_DESCRIPTION: {
    title: '{n} search descriptions get cut off mid-sentence',
    cost: 'Your pitch ends in "..." before it reaches the point',
    action: "We'll trim each to fit, keeping the strongest part. Nothing on your site changes",
    fixClass: FIX_CLASS.LONG_META_DESCRIPTION ?? 'AUTO',
    technical: 'Meta description exceeds standard search snippet length (> 160 characters).',
  },
  MISSING_ALT_TEXT: {
    title: '{n} images are invisible to Google and to blind visitors',
    cost: "Image search sends free traffic you're not collecting, and screen readers skip these entirely — which is also an accessibility risk",
    action: "We'll describe each image in a short line of hidden text. Your images look exactly the same",
    fixClass: FIX_CLASS.MISSING_ALT_TEXT ?? 'AUTO',
    technical: '<img> tags missing alt attribute or containing empty alt text.',
  },
  MISSING_CANONICAL: {
    title: "{n} pages don't tell Google which version is the real one",
    cost: 'When the same page is reachable by several addresses, Google splits the credit between them and all versions rank worse',
    action: "We'll mark the main version of each page. Invisible to visitors",
    fixClass: FIX_CLASS.MISSING_CANONICAL ?? 'AUTO',
    technical: 'Missing rel=canonical link element in head.',
  },
  BROKEN_CANONICAL: {
    title: "{n} pages point Google at a page that doesn't exist",
    cost: 'Google is being told "the real version of this page is over there" — and there is nothing there, so it may drop the page entirely',
    action: "We'll point each page at itself or at the correct version",
    fixClass: FIX_CLASS.BROKEN_CANONICAL ?? 'AUTO',
    technical: 'rel=canonical target returns 4xx/5xx or cannot be fetched.',
  },
  CANONICAL_CROSS_DOMAIN: {
    title: "{n} pages tell Google the real version is on someone else's website",
    cost: "You are handing your search credit to another domain. If this wasn't deliberate, it is costing you every ranking on those pages",
    action:
      "We'll point each page back to your own site. Flagged for your confirmation first if the other domain is one of yours",
    fixClass: FIX_CLASS.CANONICAL_CROSS_DOMAIN ?? 'APPROVAL',
    technical: 'rel=canonical href points to a foreign domain.',
  },
  NOT_IN_SITEMAP: {
    title: "{n} pages aren't on the map you give Google",
    cost: 'Google may take weeks to find these pages, or never find them. New pages suffer most',
    action: "We'll add them to your sitemap. Nothing visible changes",
    fixClass: FIX_CLASS.NOT_IN_SITEMAP ?? 'AUTO',
    technical: 'URL discovered in site navigation but absent from sitemap.xml.',
  },
  NOINDEX_DETECTED: {
    title: '{n} pages are telling Google not to show them at all',
    cost: 'These pages cannot appear in search results, no matter how good they are. Often left over from a site build',
    action:
      "We'll remove the instruction after you confirm each page should be public — some pages are hidden on purpose",
    fixClass: FIX_CLASS.NOINDEX_DETECTED ?? 'APPROVAL',
    technical: 'Robots meta tag or X-Robots-Tag header contains noindex directive.',
  },
  INCORRECT_ROBOTS: {
    title: 'Your site is blocking Google from parts of it',
    cost: 'Anything blocked cannot rank. This is a site-wide setting, so the damage is broad',
    action:
      "We'll propose a corrected rules file for your approval. This one is worth a careful look before it ships",
    fixClass: FIX_CLASS.INCORRECT_ROBOTS ?? 'APPROVAL',
    technical: 'robots.txt contains Disallow rules blocking valuable sections of the site.',
  },
  MISSING_H1: {
    title: '{n} pages have no headline',
    cost: 'The main heading tells both visitors and Google what the page is about in one line. Without it, both are guessing. These pages get {traffic}',
    action:
      "We'll add a headline to each page. This is visible on your site, so you'll see a preview and approve it first",
    fixClass: FIX_CLASS.MISSING_H1 ?? 'APPROVAL',
    technical: 'Document body contains zero <h1> elements.',
  },
  MULTIPLE_H1: {
    title: '{n} pages have several competing headlines',
    cost: "When everything is the headline, nothing is. Google can't work out the page's main subject",
    action: "We'll keep the most relevant one as the headline and demote the rest. Visible change — you'll approve a preview",
    fixClass: FIX_CLASS.MULTIPLE_H1 ?? 'APPROVAL',
    technical: 'Document body contains more than one <h1> element.',
  },
  BROKEN_LINK_4XX: {
    title: "{n} links on your site lead to pages that don't exist",
    cost: 'Visitors hit a dead end and leave. Google reads broken links as a sign the site is unmaintained',
    action: "We'll show you each broken link with a suggested replacement, and fix them once you confirm",
    fixClass: FIX_CLASS.BROKEN_LINK_4XX ?? 'APPROVAL',
    technical: 'Internal anchor href points to a destination returning HTTP 4xx.',
  },
  BROKEN_IMAGE: {
    title: "{n} images don't load",
    cost: 'Visitors see a broken icon where a product photo should be. On a product page this kills the sale',
    action: "We'll list each one so you can re-upload, and remove any that are genuinely gone",
    fixClass: FIX_CLASS.BROKEN_IMAGE ?? 'APPROVAL',
    technical: '<img> src returns 4xx/5xx or fails network request.',
  },
  REDIRECT_CHAIN: {
    title: '{n} pages bounce visitors through several addresses before arriving',
    cost: 'Every extra hop slows the page and leaks a little ranking strength. On mobile this is felt',
    action: "We'll point the first address straight at the final one",
    fixClass: FIX_CLASS.REDIRECT_CHAIN ?? 'APPROVAL',
    technical: 'URL triggers 2 or more sequential HTTP redirects before reaching target.',
  },
  REDIRECT_LOOP: {
    title: '{n} pages send visitors round in circles and never load',
    cost: 'These pages are completely unreachable — for visitors and for Google',
    action:
      "This needs a look at your redirect rules, which usually live in your hosting settings. We'll show you exactly which rules conflict",
    fixClass: FIX_CLASS.REDIRECT_LOOP ?? 'MANUAL',
    technical: 'Circular redirect sequence detected (e.g. A -> B -> A).',
  },
  SERVER_ERROR_5XX: {
    title: '{n} pages are returning an error instead of loading',
    cost: 'Your server is failing on these pages. If Google keeps hitting errors it stops visiting the site as often',
    action:
      "This is a hosting or application problem we can't patch from here. We'll show you the failing addresses and the error so your developer can act",
    fixClass: FIX_CLASS.SERVER_ERROR_5XX ?? 'MANUAL',
    technical: 'Endpoint responds with HTTP 500/502/503/504 status code.',
  },
  MIXED_CONTENT: {
    title: '{n} secure pages are loading insecure content',
    cost: 'Browsers show a "not secure" warning, and some block the content outright. On a checkout page this loses orders',
    action: "We'll switch each insecure reference to its secure version. Visual check before it ships",
    fixClass: FIX_CLASS.MIXED_CONTENT ?? 'APPROVAL',
    technical: 'HTTPS page requests subresources (scripts, images, stylesheets) over insecure HTTP.',
  },
  HTTPS_ISSUE: {
    title: "Your site's security certificate has a problem",
    cost: 'Visitors may see a full-page browser warning before they reach you. Almost nobody clicks past that',
    action:
      "This is fixed with your hosting provider, not in your site's code. We'll show you exactly what's wrong so you can pass it on",
    fixClass: FIX_CLASS.HTTPS_ISSUE ?? 'MANUAL',
    technical: 'TLS certificate invalid, expired, or hostname mismatch.',
  },
  LARGE_HTML: {
    title: '{n} pages are unusually heavy and slow to load',
    cost: 'Slow pages lose visitors before they see anything, and Google uses speed as a ranking signal. Worst on mobile data',
    action: "We'll identify what's making each page heavy and propose specific reductions for your approval",
    fixClass: FIX_CLASS.LARGE_HTML ?? 'APPROVAL',
    technical: 'HTML payload size exceeds performance threshold (> 2MB).',
  },
  THIN_CONTENT: {
    title: '{n} pages have too little content to rank for anything',
    cost: 'Google treats near-empty pages as low value, and having many of them can drag down the whole site',
    action:
      "We'll draft fuller content for each page. You review and publish — we never publish words in your voice without you reading them",
    fixClass: FIX_CLASS.THIN_CONTENT ?? 'MANUAL',
    technical: 'Page contains under 150 words of body content.',
  },
  URL_STRUCTURE_ISSUE: {
    title: '{n} page addresses are hard for people and Google to read',
    cost: 'Addresses full of codes and numbers get fewer clicks than readable ones and say nothing about the page',
    action:
      "We'll propose cleaner addresses with redirects from the old ones, so no existing link breaks. Approve before it ships",
    fixClass: FIX_CLASS.URL_STRUCTURE_ISSUE ?? 'APPROVAL',
    technical: 'URL contains excessive query parameters, uppercase characters, or non-descriptive numeric tokens.',
  },
  ORPHAN_PAGE: {
    title: '{n} pages have no links pointing to them from your site',
    cost: 'Visitors and search engines cannot find these pages through your navigation, leaving them stranded and unranked',
    action: "We'll connect these pages by adding navigation and context links from your main content",
    fixClass: FIX_CLASS.ORPHAN_PAGE ?? 'APPROVAL',
    technical: 'Page has zero internal incoming links.',
  },
  SCHEMA_PRODUCT_OFFERS: {
    title: '{n} product pages are missing price and stock details in search',
    cost: 'Google cannot show price tags, in-stock badges, or buying options directly in search results',
    action: "We'll add structured price and inventory details so Google displays your products with rich badges",
    fixClass: FIX_CLASS.SCHEMA_PRODUCT_OFFERS ?? 'AUTO',
    technical: 'Missing Product Offer structured data (price, availability, priceCurrency).',
  },
  SCHEMA_PRODUCT_AGGREGATERATING: {
    title: '{n} product pages are missing star ratings in search',
    cost: 'Search results show plain links without gold review stars, which reduces shopper clicks and trust',
    action: "We'll format your verified review ratings so Google displays star ratings beside your products",
    fixClass: FIX_CLASS.SCHEMA_PRODUCT_AGGREGATERATING ?? 'AUTO',
    technical: 'Missing Product AggregateRating structured data (ratingValue, reviewCount).',
  },
};

/**
 * Pluralisation substitutions when n === 1.
 * Ensures "{n} pages have..." becomes "1 page has...", etc.
 */
const SINGULAR_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\{n\}\s+pages\s+have\b/gi, '1 page has'],
  [/\{n\}\s+product\s+pages\s+are\b/gi, '1 product page is'],
  [/\{n\}\s+page\s+titles\s+get\b/gi, '1 page title gets'],
  [/\{n\}\s+page\s+titles\s+are\b/gi, '1 page title is'],
  [/\{n\}\s+pages\s+share\b/gi, '1 page shares'],
  [/\{n\}\s+pages\s+let\b/gi, '1 page lets'],
  [/\{n\}\s+search\s+descriptions\s+get\b/gi, '1 search description gets'],
  [/\{n\}\s+images\s+are\b/gi, '1 image is'],
  [/\{n\}\s+pages\s+don't\b/gi, "1 page doesn't"],
  [/\{n\}\s+pages\s+point\b/gi, '1 page points'],
  [/\{n\}\s+pages\s+tell\b/gi, '1 page tells'],
  [/\{n\}\s+pages\s+aren't\b/gi, "1 page isn't"],
  [/\{n\}\s+pages\s+are\b/gi, '1 page is'],
  [/\{n\}\s+links\s+on\s+your\s+site\s+lead\b/gi, '1 link on your site leads'],
  [/\{n\}\s+images\s+don't\b/gi, "1 image doesn't"],
  [/\{n\}\s+pages\s+bounce\b/gi, '1 page bounces'],
  [/\{n\}\s+pages\s+send\b/gi, '1 page sends'],
  [/\{n\}\s+secure\s+pages\s+are\b/gi, '1 secure page is'],
  [/\{n\}\s+page\s+addresses\s+are\b/gi, '1 page address is'],
];

export function renderCopy(
  issueType: string,
  ctx: { n: number; traffic?: number | null },
): { title: string; cost: string; action: string } {
  const copy = ISSUE_COPY[issueType];
  const n = Math.max(0, ctx.n);

  if (!copy) {
    const fallbackTitle =
      n === 1
        ? `1 page has an issue (${issueType.toLowerCase().replace(/_/g, ' ')})`
        : `${n} pages have an issue (${issueType.toLowerCase().replace(/_/g, ' ')})`;
    return {
      title: fallbackTitle,
      cost: "We can't measure how much traffic this affects until Search Console is connected.",
      action: "We'll review and propose a recommended fix for this issue.",
    };
  }

  // 1. Title formatting
  let title = copy.title;
  if (n === 1) {
    let matched = false;
    for (const [re, replacement] of SINGULAR_REPLACEMENTS) {
      if (re.test(title)) {
        title = title.replace(re, replacement);
        matched = true;
        break;
      }
    }
    if (!matched) {
      title = title.replace(/\{n\}\s+pages\b/gi, '1 page').replace(/\{n\}/g, '1');
    }
  } else {
    title = title.replace(/\{n\}/g, String(n));
  }

  // 2. Cost formatting
  let cost = copy.cost;
  if (ctx.traffic !== null && ctx.traffic !== undefined && !Number.isNaN(ctx.traffic)) {
    cost = cost.replace(/\{traffic\}/g, `${ctx.traffic}% of your search traffic`);
  } else {
    // When ctx.traffic is null, drop the sentence containing {traffic}; never print "null%"
    // Split sentences by period followed by space or end of string
    const sentences = cost.split(/(?<=\.)\s+/);
    const retained = sentences.filter((s) => !s.includes('{traffic}'));
    if (retained.length > 0) {
      cost = retained.join(' ').trim();
    } else {
      cost = "We can't measure how much traffic this affects until Search Console is connected.";
    }
    // Clean any trailing punctuation oddities if a sentence ended without period
    cost = cost.replace(/\s*\{traffic\}[^.]*(\.|$)/g, '').trim();
    if (!cost) {
      cost = "We can't measure how much traffic this affects until Search Console is connected.";
    }
  }

  // 3. Action formatting
  const action = copy.action;

  return { title, cost, action };
}
