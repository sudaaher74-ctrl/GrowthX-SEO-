import { ApiError } from "@/lib/api-client";

/**
 * Turns a failed request into something the operator can act on.
 *
 * Pages used to substitute their own guess for whatever went wrong — the
 * marketing page told every failure to go and crawl the site, including on a
 * site that had just been crawled. The backend already distinguishes a missing
 * crawl from an unreachable model from an empty token balance, and its message
 * is the one worth showing — for the last it already says when tokens refill.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return "Could not reach the GrowthX API. Check your connection and try again.";
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
