/**
 * The Google services GrowthX connects to, and what each one needs.
 *
 * These are data connectors, not engines. Nothing here analyses anything: each
 * entry says which Google API a connector talks to and the narrowest scope
 * that lets it read what the product actually shows. Scopes are listed per
 * provider rather than requested all at once so a customer connecting Search
 * Console is not asked to hand over their Business Profile as well — and so
 * that a customer who only wants one is not blocked by the review Google
 * requires for another.
 */
export type GoogleProviderId = 'search_console' | 'business_profile' | 'analytics';

export interface GoogleProvider {
  id: GoogleProviderId;
  /** Shown in the UI. */
  label: string;
  /**
   * Read-only wherever a read-only scope exists. Search Console and Analytics
   * both publish one; Business Profile does not — `business.manage` is the
   * only scope Google offers, which is why nothing in this codebase writes
   * back to a profile without an explicit user action.
   */
  scopes: string[];
  /**
   * Whether Google gates the API behind an application review, which is the
   * difference between a customer being able to connect today and waiting on
   * an approval. Surfaced in the UI so nobody is left clicking a button that
   * cannot yet work.
   */
  requiresGoogleApproval: boolean;
  /** What the customer picks after authorizing: a property, a location. */
  selectionLabel: string;
}

export const GOOGLE_PROVIDERS: Record<GoogleProviderId, GoogleProvider> = {
  search_console: {
    id: 'search_console',
    label: 'Google Search Console',
    // webmasters.readonly reads both the site list and the performance data.
    // The writable `webmasters` scope would also allow submitting sitemaps and
    // removing properties, neither of which this product does.
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
    requiresGoogleApproval: false,
    selectionLabel: 'property',
  },
  analytics: {
    id: 'analytics',
    label: 'Google Analytics 4',
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
    requiresGoogleApproval: false,
    selectionLabel: 'property',
  },
  business_profile: {
    id: 'business_profile',
    label: 'Google Business Profile',
    scopes: ['https://www.googleapis.com/auth/business.manage'],
    // The Business Profile APIs are not enabled by default on a Cloud project.
    // Access is requested through Google's form and granted per project, which
    // takes days. A customer cannot connect until that is done, so the UI has
    // to say so rather than offering a button that returns a 403.
    requiresGoogleApproval: true,
    selectionLabel: 'business location',
  },
};

export function isGoogleProvider(value: string): value is GoogleProviderId {
  return value in GOOGLE_PROVIDERS;
}
