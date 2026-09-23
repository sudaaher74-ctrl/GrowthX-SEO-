/**
 * Whether a single live re-fetch of a page proves one audit issue is fixed.
 *
 * Verification used to decide this by substring: anything it did not
 * recognise was marked VERIFIED — and written back as RESOLVED — as soon as
 * the page answered 200, a missing canonical was reported as "self-referential
 * canonical verified", and META_ROBOTS_NOINDEX was "fixed" by having a meta
 * description. Each check below applies the same threshold the audit rule in
 * issue-rules.ts used to raise the issue, and a type that one page fetch cannot
 * settle (duplicates, thin content, schema validity, site-wide problems) is
 * left for the next full crawl rather than guessed.
 */

export interface PageFacts {
  url: string;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  h1Count: number;
  imagesMissingAlt: number;
  metaRobots: string | null;
  schemaTypes: string[];
}

export type Verdict =
  | { status: 'VERIFIED' | 'FAILED'; afterMetric: string; proofSummary: string }
  | { status: 'PARTIAL'; afterMetric: string; proofSummary: string };

/** Mirrors the thresholds in issue-rules.ts. */
const TITLE_MAX = 65;
const META_DESCRIPTION_MAX = 160;

function sameUrl(a: string, b: string): boolean {
  const norm = (u: string) => {
    try {
      const parsed = new URL(u);
      return `${parsed.host.replace(/^www\./, '')}${parsed.pathname.replace(/\/+$/, '')}`.toLowerCase();
    } catch {
      return u.replace(/\/+$/, '').toLowerCase();
    }
  };
  return norm(a) === norm(b);
}

function pass(afterMetric: string, proofSummary: string): Verdict {
  return { status: 'VERIFIED', afterMetric, proofSummary };
}

function fail(afterMetric: string, proofSummary: string): Verdict {
  return { status: 'FAILED', afterMetric, proofSummary };
}

export function verdictFor(issueType: string, page: PageFacts): Verdict {
  const type = issueType.toUpperCase();

  switch (type) {
    case 'MISSING_TITLE':
      return page.title
        ? pass(`Title present (${page.title.length} chars)`, `<title> found: "${page.title.slice(0, 60)}"`)
        : fail('Missing <title> tag', 'No <title> element on the re-fetched page.');

    case 'LONG_TITLE':
      if (!page.title) return fail('Missing <title> tag', 'No <title> element on the re-fetched page.');
      return page.title.length <= TITLE_MAX
        ? pass(`Title is ${page.title.length} chars`, `Within the ${TITLE_MAX}-character limit the audit applies.`)
        : fail(`Title is ${page.title.length} chars`, `Still longer than the ${TITLE_MAX}-character limit.`);

    case 'MISSING_META_DESCRIPTION':
      return page.metaDescription
        ? pass(`Meta description present (${page.metaDescription.length} chars)`, `Found: "${page.metaDescription.slice(0, 60)}"`)
        : fail('Missing meta description', 'No <meta name="description"> on the re-fetched page.');

    case 'LONG_META_DESCRIPTION':
      if (!page.metaDescription) return fail('Missing meta description', 'No <meta name="description"> on the re-fetched page.');
      return page.metaDescription.length <= META_DESCRIPTION_MAX
        ? pass(`Meta description is ${page.metaDescription.length} chars`, `Within the ${META_DESCRIPTION_MAX}-character limit.`)
        : fail(`Meta description is ${page.metaDescription.length} chars`, `Still longer than ${META_DESCRIPTION_MAX} characters.`);

    case 'NO_CANONICAL':
    case 'MISSING_CANONICAL':
      return page.canonical
        ? pass(`Canonical present: ${page.canonical}`, 'A <link rel="canonical"> is now declared.')
        : fail('No canonical tag', 'No <link rel="canonical"> on the re-fetched page.');

    case 'CANONICAL_POINTS_ELSEWHERE':
      if (!page.canonical) return fail('No canonical tag', 'No <link rel="canonical"> on the re-fetched page.');
      return sameUrl(page.canonical, page.url)
        ? pass(`Canonical is self-referential`, `Canonical ${page.canonical} matches the page URL.`)
        : fail(`Canonical points to ${page.canonical}`, 'The canonical still names a different URL.');

    case 'MISSING_H1':
      return page.h1Count > 0
        ? pass(`${page.h1Count} H1 heading(s)`, 'An H1 heading is now present.')
        : fail('No H1 heading', 'No <h1> on the re-fetched page.');

    case 'MULTIPLE_H1':
      return page.h1Count === 1
        ? pass('Exactly one H1', 'The page now has a single H1.')
        : fail(`${page.h1Count} H1 headings`, 'The page still does not have exactly one H1.');

    case 'MISSING_ALT_TEXT':
      return page.imagesMissingAlt === 0
        ? pass('Every image has an alt attribute', 'No <img> without an alt attribute on the re-fetched page.')
        : fail(`${page.imagesMissingAlt} image(s) without alt`, 'Images without an alt attribute remain.');

    case 'META_ROBOTS_NOINDEX':
      return page.metaRobots && /noindex/i.test(page.metaRobots)
        ? fail(`meta robots: ${page.metaRobots}`, 'The page still asks not to be indexed.')
        : pass('No noindex directive', 'The meta robots tag no longer contains noindex.');
  }

  // "Missing schema" can be settled by presence; a schema *error* cannot,
  // because a block being present says nothing about whether it is valid.
  if (/^(MISSING|NO)_.*SCHEMA|SCHEMA_MISSING/.test(type)) {
    return page.schemaTypes.length > 0
      ? pass(`Detected ${page.schemaTypes.join(', ')}`, 'JSON-LD is now present on the page.')
      : fail('No JSON-LD found', 'No application/ld+json block on the re-fetched page.');
  }

  return {
    status: 'PARTIAL',
    afterMetric: 'Not re-checkable from one page fetch',
    proofSummary: 'The page responded, but this issue type is only confirmed by the next full crawl, so it was left open.',
  };
}
