import { FetchOutcome } from './fetch/fetch.service';
import { ExtractedPage } from './page-extract';
import { IndexabilityResult } from './indexability';
import { SitemapFinding } from './discovery/discovery.service';
import { DuplicateCluster } from './frontier/duplicate-clusters';
import { registrableDomain } from './url/registrable-domain';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type Confidence = 'CONFIRMED' | 'LIKELY' | 'ADVISORY';

export interface Finding {
  id: string;
  severity: Severity;
  confidence: Confidence;
  category: 'TECHNICAL' | 'CONTENT' | 'SCHEMA' | 'LINKS' | 'PERFORMANCE';
  affectedUrl: string;
  description: string;
  explanation: string;
  impact: string;
  recommendation: string;
  /** The literal value observed, so the user can verify it themselves. */
  evidence: string;
  /** The field the evidence was read from. */
  sourceField: string;
  dedupKey: string;
  aiFixAvailable: boolean;
}

export interface PageRuleInput {
  url: string;
  fetch: FetchOutcome;
  extracted?: ExtractedPage;
  indexability: IndexabilityResult;
  isHomepage: boolean;
  inSitemap: boolean;
  /** URLs sharing this page's content fingerprint, if any. */
  duplicateCluster?: DuplicateCluster;
}

const THIN_CONTENT_WORDS = 250;

/**
 * Rules for one page.
 *
 * The cascade rule comes first and is the important one. When a page could not
 * be fetched, or is suspected of being blocked, exactly one finding is emitted
 * and every content rule is suppressed.
 *
 * On dronaarchery.com the old engine produced five findings from one phantom
 * 403 — a missing title, a missing meta description, a missing canonical, a
 * missing H1 and a 4xx — of which four were artefacts of a body that was never
 * received. Telling a customer their homepage has no title, when the truth is
 * that we never read their homepage, is worse than saying nothing.
 */
export function evaluatePage(input: PageRuleInput): Finding[] {
  const { url, fetch: outcome, extracted, indexability, isHomepage } = input;

  if (outcome.error) {
    return [
      {
        id: 'FETCH_FAILED',
        severity: isHomepage ? 'CRITICAL' : 'HIGH',
        confidence: 'CONFIRMED',
        category: 'TECHNICAL',
        affectedUrl: url,
        description: `Could not fetch page: ${outcome.error.label}.`,
        explanation:
          'No response was obtained from the origin, so nothing about this page could be assessed. ' +
          'This is a report of what happened on our side, not a statement about the page itself.',
        impact: 'A page we cannot reach is a page search engines may not be able to reach either. Until it can be fetched, no other finding about it would be trustworthy.',
        recommendation: `Check that ${url} resolves and responds from outside your own network. Failure kind: ${outcome.error.kind}.`,
        evidence: `${outcome.error.kind}: ${outcome.error.message}`,
        sourceField: 'fetch.error',
        dedupKey: `${url}::FETCH_FAILED`,
        aiFixAvailable: false,
      },
    ];
  }

  if (outcome.blockedSuspected) {
    return [
      {
        id: 'FETCH_BLOCKED_SUSPECTED',
        severity: 'HIGH',
        confidence: 'LIKELY',
        category: 'TECHNICAL',
        affectedUrl: url,
        description: `The origin answered HTTP ${outcome.statusCode} even with a full browser request.`,
        explanation:
          'A bot-protection layer appears to be refusing automated clients. We retried with a complete browser header set and ' +
          'then through a real browser, and the refusal persisted, so the page content could not be assessed.',
        impact:
          'Whatever refuses us may also refuse Bingbot, GPTBot, PerplexityBot and ClaudeBot. If so this page is invisible to those engines, ' +
          'and no content finding about it can be trusted until it can be fetched.',
        recommendation: 'Allow our crawler in your WAF or CDN bot rules, then re-run the audit to get a real assessment of this page.',
        evidence: outcome.blockedEvidence || `HTTP ${outcome.statusCode}`,
        sourceField: 'fetch.blockedSuspected',
        dedupKey: `${url}::FETCH_BLOCKED_SUSPECTED`,
        aiFixAvailable: false,
      },
    ];
  }

  const findings: Finding[] = [];
  const status = outcome.statusCode ?? 0;

  if (status >= 500) {
    findings.push({
      id: 'SERVER_ERROR_5XX',
      severity: 'CRITICAL',
      confidence: 'CONFIRMED',
      category: 'TECHNICAL',
      affectedUrl: url,
      description: `Page returned HTTP ${status}.`,
      explanation: 'A server error means the page could not be produced at all.',
      impact: 'Search engines drop consistently failing URLs from their index.',
      recommendation: 'Investigate the server error and re-crawl once the page responds.',
      evidence: `HTTP ${status} from ${outcome.finalUrl}`,
      sourceField: 'fetch.statusCode',
      dedupKey: `${url}::SERVER_ERROR_5XX`,
      aiFixAvailable: false,
    });
    // A page that errored has no content to assess.
    return findings;
  }

  if (status >= 400) {
    findings.push({
      id: 'BROKEN_PAGE_4XX',
      severity: isHomepage ? 'CRITICAL' : 'HIGH',
      confidence: 'CONFIRMED',
      category: 'TECHNICAL',
      affectedUrl: url,
      description: `Page returned HTTP ${status}.`,
      explanation: 'The origin reports that this URL does not exist or cannot be served.',
      impact: 'Any link pointing here wastes the crawl budget and the link equity it carries.',
      recommendation: 'Restore the page or redirect the URL to its replacement.',
      evidence: `HTTP ${status} from ${outcome.finalUrl}`,
      sourceField: 'fetch.statusCode',
      dedupKey: `${url}::BROKEN_PAGE_4XX`,
      aiFixAvailable: false,
    });
    return findings;
  }

  // Redirect chains: recorded as hops, so this can distinguish a loop from a
  // tidy apex-to-www hop rather than counting both as errors.
  const redirectHops = outcome.statusChain.filter((hop) => hop.status >= 300 && hop.status < 400);
  if (redirectHops.length >= 3) {
    findings.push({
      id: 'REDIRECT_CHAIN',
      severity: 'MEDIUM',
      confidence: 'CONFIRMED',
      category: 'TECHNICAL',
      affectedUrl: url,
      description: `This URL redirects ${redirectHops.length} times before resolving.`,
      explanation: 'Each hop costs a round trip and loses a little link equity.',
      impact: 'Slower first paint for visitors and a larger crawl budget spent per page.',
      recommendation: `Point ${url} straight at ${outcome.finalUrl}.`,
      evidence: outcome.statusChain.map((hop) => `${hop.status} ${hop.url}${hop.location ? ` -> ${hop.location}` : ''}`).join(' | '),
      sourceField: 'fetch.statusChain',
      dedupKey: `${url}::REDIRECT_CHAIN`,
      aiFixAvailable: false,
    });
  }

  if (!extracted) return findings;

  // The finding this rebuild exists to surface.
  if (outcome.jsRequired && outcome.renderDiff) {
    const diff = outcome.renderDiff;
    findings.push({
      id: 'JS_RENDER_REQUIRED',
      severity: 'LOW',
      confidence: 'ADVISORY',
      category: 'TECHNICAL',
      affectedUrl: url,
      description: 'Content was available after JavaScript rendering on this crawl.',
      explanation: 'The rendered response contains content absent from the initial HTML. Rendering succeeded; this alone does not establish an indexing failure.',
      impact: 'Consumers that do not execute JavaScript may receive less content. GPTBot, PerplexityBot and ClaudeBot behavior and ranking impact were not measured.',
      recommendation:
        'Server-render or pre-render this route so the title, meta description, copy and navigation are present in the initial HTML response.',
      evidence:
        `Raw HTML: ${diff.rawWordCount} words, ${diff.rawLinkCount} links, title "${diff.rawTitle ?? '(none)'}". ` +
        `After rendering: ${diff.renderedWordCount} words, ${diff.renderedLinkCount} links, title "${diff.renderedTitle ?? '(none)'}". ` +
        (diff.fingerprints.length ? `Build fingerprints: ${diff.fingerprints.join(', ')}.` : ''),
      sourceField: 'fetch.renderDiff',
      dedupKey: `${url}::JS_RENDER_REQUIRED`,
      aiFixAvailable: false,
    });
  }

  if (outcome.renderUnavailable && outcome.escalationReasons.length > 0) {
    findings.push({
      id: 'RENDER_UNAVAILABLE',
      severity: 'MEDIUM',
      confidence: 'CONFIRMED',
      category: 'TECHNICAL',
      affectedUrl: url,
      description: 'This page needs JavaScript to be read, and we could not render it on this crawl.',
      explanation: 'The static response is an empty shell and the render tier was unavailable or out of budget, so the findings below are incomplete.',
      impact: 'Content findings for this page should not be trusted until it has been rendered.',
      recommendation: 'Re-run the audit with the render budget raised for this site.',
      evidence: `Escalation reasons: ${outcome.escalationReasons.join(', ')}`,
      sourceField: 'fetch.renderUnavailable',
      dedupKey: `${url}::RENDER_UNAVAILABLE`,
      aiFixAvailable: false,
    });
    // Anything below would be measured against a shell.
    return findings;
  }

  if (!extracted.title) {
    findings.push(content('MISSING_TITLE', isHomepage ? 'CRITICAL' : 'HIGH', 'CONFIRMED', url, {
      description: 'Page has no <title> tag.',
      explanation: 'The title is the clickable headline in search results and one of the strongest on-page signals.',
      impact: 'Search engines synthesise a title from page text, which is rarely what you would have chosen.',
      recommendation: 'Add a unique title of 30-60 characters describing this page.',
      evidence: 'No <title> element in the document head.',
      sourceField: 'extracted.title',
    }));
  } else if (extracted.titleLength > 65) {
    findings.push(content('LONG_TITLE', extracted.titleLength > 80 ? 'MEDIUM' : 'LOW', 'LIKELY', url, {
      description: `Title is ${extracted.titleLength} characters, beyond the ~60 that fit in a result.`,
      explanation: 'Google truncates titles at roughly 600 pixels.',
      impact: 'A cut-off title reads awkwardly in results and can cost click-through.',
      recommendation: 'Shorten to under 60 characters with the important words first.',
      evidence: `"${extracted.title}" (${extracted.titleLength} characters)`,
      sourceField: 'extracted.title',
    }));
  }

  if (!extracted.metaDescription) {
    findings.push(content('MISSING_META_DESCRIPTION', 'MEDIUM', 'LIKELY', url, {
      description: 'Page has no meta description.',
      explanation: 'The meta description is the snippet shown under the title in search results.',
      impact: 'Search engines extract arbitrary copy instead, which is rarely conversion-focused.',
      recommendation: 'Add a description of 120-160 characters.',
      evidence: 'No <meta name="description"> in the document head.',
      sourceField: 'extracted.metaDescription',
    }));
  } else if (extracted.metaDescriptionLength > 160) {
    findings.push(content('LONG_META_DESCRIPTION', 'LOW', 'ADVISORY', url, {
      description: `Meta description is ${extracted.metaDescriptionLength} characters.`,
      explanation: 'Descriptions over about 160 characters are truncated.',
      impact: 'The end of your sentence is replaced with an ellipsis.',
      recommendation: 'Trim to 160 characters.',
      evidence: `"${extracted.metaDescription}" (${extracted.metaDescriptionLength} characters)`,
      sourceField: 'extracted.metaDescription',
    }));
  }

  const conflictingCanonicals = (extracted.canonicalUrls?.length || 0) > 1;
  const utilityPage = /\/(?:app\/)?(?:login|register|sign-in|signup|account|cart|checkout|wallet)(?:\/|$)/i.test(new URL(url).pathname);
  const searchContent = !utilityPage && !/(?:^|[,;\s])(?:noindex|none)(?:$|[,;\s])/i.test(extracted.metaRobots || '');
  if (conflictingCanonicals) {
    findings.push(content('CONFLICTING_CANONICALS', 'HIGH', 'CONFIRMED', url, {
      description: 'Page declares conflicting canonical URLs.',
      explanation: 'The page declares more than one preferred URL.',
      impact: 'Search engines may ignore conflicting hints; the indexed URL was not measured.',
      recommendation: 'Review the intended preferred URL and remove conflicting canonical tags.',
      evidence: extracted.canonicalUrls!.join(' | '), sourceField: 'extracted.canonicalUrls',
    }));
  } else if (!extracted.canonicalUrl) {
    findings.push(content('NO_CANONICAL', 'MEDIUM', 'LIKELY', url, {
      description: 'Page declares no canonical URL.',
      explanation:
        'Without a canonical, every URL that serves this page - with a tracking parameter, with and without a trailing slash, on www and without - ' +
        'is a separate candidate for indexing, and the search engine picks one for you.',
      impact: 'Ranking signals split across duplicate URLs instead of accumulating on one.',
      recommendation: `Add <link rel="canonical" href="${url}"> to this page.`,
      evidence: 'No <link rel="canonical"> in the document head.',
      sourceField: 'extracted.canonicalUrl',
    }));
  } else if (extracted.canonicalIsSelfReferential === false) {
    const crossDomain = registrableDomain(extracted.canonicalUrl) !== registrableDomain(url);
    findings.push(content('CANONICAL_POINTS_ELSEWHERE', crossDomain ? 'CRITICAL' : 'MEDIUM', 'CONFIRMED', url, {
      description: crossDomain ? 'Canonical points to a different domain.' : 'Canonical points to a different URL.',
      explanation: 'A canonical tells search engines to index the target instead of this page.',
      impact: crossDomain
        ? 'Search engines may consolidate this page with the declared external target.'
        : 'Search engines may consolidate this page with the declared target. The indexed URL was not measured.',
      recommendation: crossDomain ? 'Point the canonical at this page unless handing the ranking away is deliberate.' : 'Confirm the canonical target is the page you want indexed.',
      evidence: `<link rel="canonical" href="${extracted.canonicalUrl}"> on ${url}`,
      sourceField: 'extracted.canonicalUrl',
    }));
  }

  if (extracted.h1.length === 0) {
    findings.push(content('MISSING_H1', 'HIGH', 'CONFIRMED', url, {
      description: 'Page has no H1 heading.',
      explanation: 'The H1 states what the page is about, for readers and for search engines.',
      impact: 'Topical relevance is harder to establish and screen-reader navigation is degraded.',
      recommendation: 'Add a single descriptive H1.',
      evidence: `Headings found: ${extracted.headings.length === 0 ? 'none' : extracted.headings.map((h) => `h${h.level}`).join(', ')}`,
      sourceField: 'extracted.headings',
    }));
  } else if (extracted.h1.length > 1) {
    findings.push(content('MULTIPLE_H1', 'LOW', 'ADVISORY', url, {
      description: `Page has ${extracted.h1.length} H1 headings.`,
      explanation: 'HTML5 permits several, but one primary heading states the topic most clearly.',
      impact: 'Diluted topical focus; minor, and not always worth changing.',
      recommendation: 'Keep one H1 and demote the rest to H2.',
      evidence: extracted.h1.map((t) => `"${t}"`).join(', '),
      sourceField: 'extracted.h1',
    }));
  }

  // Suppressed for a page in a duplicate cluster: the defect there is
  // duplication, reported once for the cluster, not thinness on each copy.
  if (searchContent && extracted.wordCount < THIN_CONTENT_WORDS && !input.duplicateCluster) {
    findings.push(content('THIN_CONTENT', 'MEDIUM', 'LIKELY', url, {
      description: `Page has ${extracted.wordCount} words of main content.`,
      explanation: `Below roughly ${THIN_CONTENT_WORDS} words there is usually not enough substance to answer a query fully.`,
      impact: 'Thin pages rank poorly and are rarely cited by AI answer engines.',
      recommendation: 'Expand the page with material that answers what a visitor actually came to find out.',
      evidence: `${extracted.wordCount} words in main content, ${extracted.bodyWordCount} including navigation, header and footer.`,
      sourceField: 'extracted.wordCount',
    }));
  }

  const missingAlt = extracted.images.filter((img) => img.alt === undefined || img.alt.trim() === '');
  if (missingAlt.length > 0) {
    findings.push(content('MISSING_ALT_TEXT', 'MEDIUM', 'CONFIRMED', url, {
      description: `${missingAlt.length} of ${extracted.images.length} images have no alt text.`,
      explanation: 'Alt text describes an image to screen readers and to image search.',
      impact: 'Lost image-search traffic and an accessibility failure.',
      recommendation: 'Add descriptive alt text to each image that carries meaning.',
      evidence: missingAlt.slice(0, 5).map((img) => img.src).join(', '),
      sourceField: 'extracted.images',
    }));
  }

  if (indexability.indexability === 'NOT_INDEXABLE') {
    for (const reason of indexability.reasons) {
      if (reason.code === 'META_ROBOTS_NOINDEX' || reason.code === 'X_ROBOTS_TAG_NOINDEX') {
        findings.push(content('NOINDEX_DETECTED', 'CRITICAL', 'CONFIRMED', url, {
          description: 'Page is marked noindex.',
          explanation: 'A noindex directive tells search engines to keep this URL out of results entirely.',
          impact: 'This page earns nothing from search, however good it is. If it shipped by accident, the loss is total.',
          recommendation: 'Remove the noindex directive if this page is meant to be found.',
          evidence: reason.evidence,
          sourceField: reason.code === 'META_ROBOTS_NOINDEX' ? 'extracted.metaRobots' : 'fetch.headers.x-robots-tag',
        }));
      }
      if (reason.code === 'ROBOTS_TXT_DISALLOW') {
        findings.push(content('ROBOTS_TXT_BLOCKED', 'HIGH', 'CONFIRMED', url, {
          description: 'robots.txt disallows this URL for our crawler.',
          explanation: 'A disallowed URL is not fetched by compliant crawlers.',
          impact: 'The page cannot be assessed, and search engines following the same rule will not read it either.',
          recommendation: 'Relax the rule if this page should be crawlable.',
          evidence: reason.evidence,
          sourceField: 'robots.txt',
        }));
      }
    }
  }

  if (!input.inSitemap && status === 200 && !isHomepage && searchContent && !conflictingCanonicals && extracted.canonicalIsSelfReferential !== false) {
    findings.push(content('NOT_IN_SITEMAP', 'LOW', 'ADVISORY', url, {
      description: 'Page is not listed in the sitemap.',
      explanation: 'A sitemap is how a site tells search engines which URLs it considers worth indexing.',
      impact: 'Slower discovery, particularly for pages with few internal links.',
      recommendation: 'Add this URL to your sitemap, or remove it if it is not meant to be indexed.',
      evidence: `${url} was not present in any sitemap discovered for this site.`,
      sourceField: 'discovery.sitemap',
    }));
  }

  // ── DEEP WEBSITE FORENSICS (High-signal checks most SEO tools miss) ──

  // 1. Slow Server Response (TTFB)
  if (outcome.ttfbMs != null && outcome.ttfbMs >= 1000) {
    const ttfbRounded = Math.round(outcome.ttfbMs);
    findings.push({
      id: 'SLOW_SERVER_TTFB',
      severity: ttfbRounded >= 1800 ? 'HIGH' : 'MEDIUM',
      confidence: 'CONFIRMED',
      category: 'PERFORMANCE',
      affectedUrl: url,
      description: `Server took ${(ttfbRounded / 1000).toFixed(2)}s before sending the first byte of this page.`,
      explanation: 'Before a visitor sees anything on screen, your web server must answer the request. Anything over 0.8s delays the entire page load.',
      impact: 'Slow server responses directly hurt mobile conversions, Core Web Vitals (LCP), and how many pages Google crawls per visit.',
      recommendation: 'Enable full-page caching or a CDN (like Cloudflare), optimize slow database queries, and keep server response time under 600ms.',
      evidence: `TTFB measured at ${ttfbRounded}ms on ${outcome.finalUrl}`,
      sourceField: 'fetch.ttfbMs',
      dedupKey: `${url}::SLOW_SERVER_TTFB`,
      aiFixAvailable: false,
    });
  }

  // 2. Temporary 302/307 Redirect Used Instead of Permanent 301/308
  const tempRedirects = outcome.statusChain.filter((hop) => hop.status === 302 || hop.status === 307);
  if (tempRedirects.length > 0) {
    findings.push({
      id: 'TEMPORARY_REDIRECT_302',
      severity: 'MEDIUM',
      confidence: 'CONFIRMED',
      category: 'TECHNICAL',
      affectedUrl: url,
      description: `URL uses a temporary HTTP ${tempRedirects[0].status} redirect instead of a permanent 301 redirect.`,
      explanation: 'Temporary redirects tell Google the move is short-term, so search engines hesitate to pass full ranking strength to the new URL.',
      impact: 'Backlink authority and ranking signals can stay split between the old and new URLs.',
      recommendation: `Change the ${tempRedirects[0].status} redirect to a permanent 301 redirect pointing directly to ${outcome.finalUrl}.`,
      evidence: tempRedirects.map((h) => `${h.status} ${h.url}${h.location ? ` -> ${h.location}` : ''}`).join(' | '),
      sourceField: 'fetch.statusChain',
      dedupKey: `${url}::TEMPORARY_REDIRECT_302`,
      aiFixAvailable: false,
    });
  }

  // 3. Images Missing Width & Height (Direct Mobile Layout Shift / CLS Cause)
  const unsizedImages = extracted.images.filter((img) => !img.width || !img.height);
  if (unsizedImages.length >= 2) {
    findings.push({
      id: 'IMAGE_CLS_DIMENSIONS_MISSING',
      severity: 'MEDIUM',
      confidence: 'CONFIRMED',
      category: 'PERFORMANCE',
      affectedUrl: url,
      description: `${unsizedImages.length} of ${extracted.images.length} images have no fixed width and height in HTML.`,
      explanation: 'When images load without reserved width and height dimensions, text and buttons jump down the screen while visitors try to read or tap.',
      impact: 'Causes poor Cumulative Layout Shift (CLS) scores on mobile, hurting both Google rankings and user trust.',
      recommendation: 'Add explicit width and height attributes (or CSS aspect-ratio) to every content image so the browser reserves space before loading.',
      evidence: unsizedImages.slice(0, 5).map((img) => img.src).join(', '),
      sourceField: 'extracted.images',
      dedupKey: `${url}::IMAGE_CLS_DIMENSIONS_MISSING`,
      aiFixAvailable: true,
    });
  }

  // 4. Internal Nofollow Leak (Site Blocking Its Own Ranking Power)
  const nofollowInternals = extracted.internalLinks.filter((l) => l.isNofollow);
  if (nofollowInternals.length > 0) {
    findings.push({
      id: 'INTERNAL_NOFOLLOW_LEAK',
      severity: 'MEDIUM',
      confidence: 'CONFIRMED',
      category: 'LINKS',
      affectedUrl: url,
      description: `${nofollowInternals.length} internal link${nofollowInternals.length === 1 ? '' : 's'} on this page carry rel="nofollow".`,
      explanation: 'Adding nofollow to links pointing to your own pages tells Google not to trust or pass authority to them.',
      impact: 'Silently starves your own product, service, or guide pages of internal ranking strength.',
      recommendation: 'Remove rel="nofollow" from internal links unless intentionally blocking login or utility routes.',
      evidence: nofollowInternals.slice(0, 5).map((l) => l.absoluteUrl).join(', '),
      sourceField: 'extracted.internalLinks',
      dedupKey: `${url}::INTERNAL_NOFOLLOW_LEAK`,
      aiFixAvailable: false,
    });
  }

  // 5. Heavy Navigation / Boilerplate Drowning Out Main Content
  if (
    searchContent &&
    extracted.bodyWordCount >= 400 &&
    extracted.wordCount > 0 &&
    extracted.wordCount / extracted.bodyWordCount < 0.2
  ) {
    const signalPct = Math.round((extracted.wordCount / extracted.bodyWordCount) * 100);
    findings.push({
      id: 'LOW_CONTENT_SIGNAL_RATIO',
      severity: 'MEDIUM',
      confidence: 'LIKELY',
      category: 'CONTENT',
      affectedUrl: url,
      description: `Only ${signalPct}% of text on this page is unique main content (${extracted.wordCount} of ${extracted.bodyWordCount} words).`,
      explanation: 'More than 80% of the words search engines read here come from repeated header menus, sidebars, or footers rather than unique page copy.',
      impact: 'Search engines and AI assistants struggle to tell what makes this page unique compared to every other page on your site.',
      recommendation: 'Add clear, unique answers, product details, or customer FAQs inside the main page body and trim repetitive footer/menu text.',
      evidence: `${extracted.wordCount} main words vs ${extracted.bodyWordCount} total body words (${signalPct}% signal)`,
      sourceField: 'extracted.wordCount',
      dedupKey: `${url}::LOW_CONTENT_SIGNAL_RATIO`,
      aiFixAvailable: false,
    });
  }

  // 6. Broken Heading Hierarchy / Wall of Text Without Subheadings
  const hasLevelSkip = extracted.headings.some((h, idx) => idx > 0 && h.level - extracted.headings[idx - 1].level >= 2);
  const longWithoutH2 = searchContent && extracted.wordCount >= 600 && extracted.h2.length === 0;
  if (hasLevelSkip || longWithoutH2) {
    findings.push({
      id: 'BROKEN_HEADING_HIERARCHY',
      severity: 'LOW',
      confidence: 'CONFIRMED',
      category: 'CONTENT',
      affectedUrl: url,
      description: longWithoutH2
        ? `Page has ${extracted.wordCount} words with no H2 section headings.`
        : 'Heading levels skip sizes (for example, jumping from H1 directly to H4).',
      explanation: 'Clear H1 → H2 → H3 headings act like a table of contents for human readers, screen readers, and AI answer engines.',
      impact: 'Visitors scan less easily and AI engines are less likely to extract clean answers from unstructured walls of text.',
      recommendation: longWithoutH2
        ? 'Break the main content into scannable sections using descriptive H2 headings every 150–250 words.'
        : 'Keep headings in sequential order (H1 → H2 → H3) without skipping levels.',
      evidence: extracted.headings.length
        ? extracted.headings.slice(0, 10).map((h) => `H${h.level}`).join(' -> ')
        : `${extracted.wordCount} words, 0 H2 headings`,
      sourceField: 'extracted.headings',
      dedupKey: `${url}::BROKEN_HEADING_HIERARCHY`,
      aiFixAvailable: false,
    });
  }

  // 7. Uncompressed Heavy HTML Payload
  const rawHtmlBytes = Buffer.byteLength(outcome.rawHtml || '', 'utf8');
  const contentEncoding = (outcome.headers['content-encoding'] || '').toLowerCase();
  const isCompressed = /gzip|br|deflate|zstd/.test(contentEncoding);
  if (rawHtmlBytes > 150_000 && !isCompressed) {
    const kb = Math.round(rawHtmlBytes / 1024);
    findings.push({
      id: 'UNCOMPRESSED_HTML_PAYLOAD',
      severity: 'MEDIUM',
      confidence: 'CONFIRMED',
      category: 'PERFORMANCE',
      affectedUrl: url,
      description: `Uncompressed HTML response is ${kb} KB with no Gzip or Brotli compression header.`,
      explanation: 'Sending large raw HTML over mobile networks without compression makes browsers wait much longer before rendering the page.',
      impact: 'Increases mobile load time and hurts Core Web Vitals on slower cellular connections.',
      recommendation: 'Enable Brotli or Gzip compression on your web server or CDN (Cloudflare / Vercel / Nginx).',
      evidence: `HTML size ${kb} KB, content-encoding: ${contentEncoding || 'none'}`,
      sourceField: 'fetch.headers.content-encoding',
      dedupKey: `${url}::UNCOMPRESSED_HTML_PAYLOAD`,
      aiFixAvailable: false,
    });
  }

  // 8. Missing Core Security Headers on Homepage (Measured from Live HTTP Headers)
  const headerKeys = Object.keys(outcome.headers || {});
  if (isHomepage && headerKeys.length >= 2 && url.startsWith('https://')) {
    const hasHsts = Boolean(outcome.headers['strict-transport-security']);
    const hasNoSniff = Boolean(outcome.headers['x-content-type-options']);
    if (!hasHsts && !hasNoSniff) {
      findings.push({
        id: 'MISSING_SECURITY_HEADERS',
        severity: 'LOW',
        confidence: 'CONFIRMED',
        category: 'TECHNICAL',
        affectedUrl: url,
        description: 'Homepage is missing standard browser security headers (HSTS and X-Content-Type-Options).',
        explanation: 'Modern browsers rely on these headers to enforce encrypted HTTPS connections and block content-type spoofing.',
        impact: 'Lower baseline security hygiene compared to modern production websites.',
        recommendation: 'Add Strict-Transport-Security and X-Content-Type-Options: nosniff headers in your hosting or CDN rules.',
        evidence: `Missing strict-transport-security & x-content-type-options (checked ${headerKeys.length} response headers)`,
        sourceField: 'fetch.headers',
        dedupKey: `${url}::MISSING_SECURITY_HEADERS`,
        aiFixAvailable: false,
      });
    }
  }

  return findings;
}

/** Findings about the site as a whole rather than one page. */
export function evaluateSite(params: {
  siteUrl: string;
  sitemapFindings: SitemapFinding[];
  duplicateClusters: DuplicateCluster[];
  deadSitemapUrls: Array<{ url: string; status?: number; reason: string }>;
}): Finding[] {
  const findings: Finding[] = [];

  for (const finding of params.sitemapFindings) {
    if (finding.kind !== 'WRONG_DOMAIN') continue;
    findings.push({
      id: 'SITEMAP_WRONG_DOMAIN',
      severity: 'CRITICAL',
      confidence: 'CONFIRMED',
      category: 'TECHNICAL',
      affectedUrl: finding.sitemapUrl,
      description: `Sitemap points at ${finding.foreignDomain}, not ${registrableDomain(params.siteUrl)}.`,
      explanation:
        'A sitemap is a list of the URLs on this site that should be indexed. This one lists URLs on a different domain, ' +
        'so it tells search engines nothing about this site at all.',
      impact:
        'Every URL in this sitemap is wasted. Search engines discover nothing from it, and any page not reachable by internal links ' +
        'may never be found. This is usually a copy-paste or a rename that was never finished.',
      recommendation: `Regenerate the sitemap with URLs on ${registrableDomain(params.siteUrl)}, and update the Sitemap directive in robots.txt to match.`,
      evidence: finding.evidence,
      sourceField: 'sitemap.loc',
      dedupKey: `${finding.sitemapUrl}::SITEMAP_WRONG_DOMAIN`,
      aiFixAvailable: false,
    });
  }

  if (params.deadSitemapUrls.length > 0) {
    findings.push({
      id: 'SITEMAP_DEAD_URLS',
      severity: 'HIGH',
      confidence: 'CONFIRMED',
      category: 'TECHNICAL',
      affectedUrl: params.siteUrl,
      description: `${params.deadSitemapUrls.length} URL(s) in the sitemap do not resolve or return an error.`,
      explanation: 'A sitemap is a statement that these URLs exist and are worth indexing.',
      impact: 'Dead sitemap entries waste crawl budget and reduce a search engine\'s trust in the whole file.',
      recommendation: 'Remove or fix the dead URLs and regenerate the sitemap.',
      evidence: params.deadSitemapUrls.slice(0, 10).map((u) => `${u.url} - ${u.reason}`).join(' | '),
      sourceField: 'sitemap.loc',
      dedupKey: `${params.siteUrl}::SITEMAP_DEAD_URLS`,
      aiFixAvailable: false,
    });
  }

  for (const cluster of params.duplicateClusters) {
    findings.push({
      id: 'DUPLICATE_CONTENT',
      severity: 'MEDIUM',
      confidence: 'CONFIRMED',
      category: 'CONTENT',
      affectedUrl: cluster.urls[0],
      description: `${cluster.urls.length} URLs serve identical content.`,
      explanation: 'Search engines must pick one of these to index and will discard the rest.',
      impact: 'Ranking signals split across copies instead of accumulating on one canonical URL.',
      recommendation: `Point every copy at one canonical URL, or serve a redirect. Suggested canonical: ${cluster.urls[0]}`,
      evidence: cluster.urls.join(', '),
      sourceField: 'page.contentHash',
      dedupKey: `${cluster.contentHash}::DUPLICATE_CONTENT`,
      aiFixAvailable: false,
    });
  }

  return findings;
}

function content(
  id: string,
  severity: Severity,
  confidence: Confidence,
  url: string,
  rest: Omit<Finding, 'id' | 'severity' | 'confidence' | 'category' | 'affectedUrl' | 'dedupKey' | 'aiFixAvailable'>,
): Finding {
  return {
    id,
    severity,
    confidence,
    category: id.includes('TITLE') || id.includes('META') || id.includes('CONTENT') ? 'CONTENT' : 'TECHNICAL',
    affectedUrl: url,
    dedupKey: `${url}::${id}`,
    aiFixAvailable: ['MISSING_TITLE', 'LONG_TITLE', 'MISSING_META_DESCRIPTION', 'LONG_META_DESCRIPTION', 'MISSING_H1', 'MISSING_ALT_TEXT', 'NO_CANONICAL'].includes(id),
    ...rest,
  };
}
