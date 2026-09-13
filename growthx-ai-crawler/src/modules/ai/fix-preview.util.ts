/**
 * The pure half of the fix preview: which surface a fix changes, and which
 * files a URL could be served from.
 *
 * Separated from the service so it can be tested directly. The service imports
 * `@octokit/rest`, which is ESM-only and cannot be loaded by this project's
 * jest transform, so anything worth pinning down in a test has to live outside
 * that import.
 */

import { FixType } from './fix-generator';

/** Where the reader would go to see this fix take effect. */
export type FixSurface = 'PAGE' | 'SERP' | 'METADATA';

export interface FixLocation {
  /** The file to edit, when it could be confirmed. */
  path: string | null;
  /**
   * `repository` — confirmed present in the connected repo's tree.
   * `derived`    — inferred from the URL; no repo was reachable to confirm it.
   */
  source: 'repository' | 'derived';
  /** Every path tried, so a wrong guess is debuggable rather than mysterious. */
  candidates: string[];
  note: string;
}

export interface FixBefore {
  /** The current value, for fixes that replace text. Null when nothing exists. */
  value: string | null;
  /** The JSON-LD already on the page, for schema fixes. */
  existingSchemas: Array<{ schemaType: string; isValid: boolean; rawJson: string | null }>;
  note: string;
}

export interface FixPreview {
  fixType: FixType;
  issueType: string;
  targetUrl: string;
  before: FixBefore;
  after: {
    proposedValue: string;
    codeSnippet: string;
    /** Whether a model wrote this or the deterministic fallback did. */
    source: 'model' | 'heuristic';
    model?: string;
  };
  location: FixLocation;
  surface: FixSurface;
  /** An external check that proves the fix landed. Null when none applies. */
  validatorUrl: string | null;
  surfaceNote: string;
}

/**
 * Which surface each fix changes.
 *
 * This is what decides whether a visual before/after is meaningful at all.
 * JSON-LD and canonical tags change nothing a visitor can see, so offering a
 * screenshot comparison for them would imply a change that will never appear.
 */
export const SURFACE: Record<FixType, FixSurface> = {
  META_TITLE: 'SERP',
  META_DESCRIPTION: 'SERP',
  CANONICAL_URL: 'METADATA',
  FAQ_SCHEMA: 'METADATA',
  PRODUCT_SCHEMA: 'METADATA',
  ORGANIZATION_SCHEMA: 'METADATA',
  BREADCRUMB_SCHEMA: 'METADATA',
  ALT_TEXT: 'METADATA',
  HEADING_STRUCTURE: 'PAGE',
  INTERNAL_LINKING: 'PAGE',
};

export const SURFACE_NOTE: Record<FixSurface, string> = {
  PAGE: 'This changes what visitors see. Preview it against your real page in Design Studio before publishing.',
  SERP: 'This changes how the page appears in search results, not the page itself. Nothing on the page will look different.',
  METADATA: 'This is metadata a visitor never sees. There is no visual before and after — the code diff and the validator below are the evidence.',
};

export const SCHEMA_FIXES: FixType[] = [
  'FAQ_SCHEMA',
  'PRODUCT_SCHEMA',
  'ORGANIZATION_SCHEMA',
  'BREADCRUMB_SCHEMA',
];

/**
 * The files a URL could plausibly be served from, most specific first.
 *
 * This is the part that decides whether a customer is told to edit the right
 * file, so it is pinned down by its own test.
 */
export function candidatePaths(url: string): string[] {
  let segments: string[];
  try {
    segments = new URL(url).pathname.split('/').filter(Boolean);
  } catch {
    return [];
  }

  const route = segments.join('/');
  const isRoot = segments.length === 0;
  const paths: string[] = [];

  // A client's site is often one workspace in a monorepo, so the app is not
  // necessarily at the repository root.
  for (const root of ['src/app', 'app', 'src/pages', 'pages']) {
    const isAppRouter = root.endsWith('app');
    for (const ext of ['tsx', 'jsx', 'ts', 'js']) {
      if (isAppRouter) {
        paths.push(isRoot ? `${root}/page.${ext}` : `${root}/${route}/page.${ext}`);
      } else {
        paths.push(isRoot ? `${root}/index.${ext}` : `${root}/${route}.${ext}`);
        if (!isRoot) paths.push(`${root}/${route}/index.${ext}`);
      }
    }
  }

  // Plain static sites.
  if (isRoot) {
    paths.push('index.html', 'public/index.html');
  } else {
    paths.push(`${route}.html`, `${route}/index.html`, `public/${route}.html`);
  }

  return paths;
}
