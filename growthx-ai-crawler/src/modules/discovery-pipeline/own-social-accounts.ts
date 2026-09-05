/**
 * Choosing which of a site's social links is the site's own account.
 *
 * A crawled site links to more social profiles than it owns: a blog post
 * quotes someone, a partner is credited, an agency signs the footer. The
 * signal that separates them is how many pages carry the link — a business
 * puts its own profiles in the footer, so they arrive on every page, while a
 * mention arrives on one.
 *
 * Kept as a pure function so the rule is stated once and can be tested without
 * a crawl, a database or a network.
 */

export interface CandidateProfile {
  platform: string;
  handle: string;
  profileUrl: string;
  pageCount: number;
}

export interface ChosenProfile extends CandidateProfile {
  /**
   * 0-100. Says how strongly the crawl supports this being the site's own
   * account — not how confident we are that the account exists, which the
   * crawl settles outright by having found it published.
   */
  confidence: number;
}

/** Why a platform was left without a chosen account. */
export interface AmbiguousPlatform {
  platform: string;
  handles: string[];
}

export interface OwnProfileSelection {
  chosen: ChosenProfile[];
  ambiguous: AmbiguousPlatform[];
}

/**
 * Picks at most one account per platform, and says when it cannot pick.
 *
 * Two profiles that appear on the same number of pages are not a tie to be
 * broken by ordering: nothing in the crawl says which belongs to the business,
 * so neither is stored and the platform is reported as ambiguous. Guessing
 * here would put a stranger's handle on a customer's account list.
 */
export function chooseOwnProfiles(candidates: CandidateProfile[]): OwnProfileSelection {
  const byPlatform = new Map<string, CandidateProfile[]>();
  for (const candidate of candidates) {
    const group = byPlatform.get(candidate.platform);
    if (group) group.push(candidate);
    else byPlatform.set(candidate.platform, [candidate]);
  }

  const chosen: ChosenProfile[] = [];
  const ambiguous: AmbiguousPlatform[] = [];

  for (const [platform, group] of byPlatform) {
    const ranked = [...group].sort((a, b) => b.pageCount - a.pageCount);
    const [best, runnerUp] = ranked;
    if (!best) continue;

    if (group.length === 1) {
      // The only profile of its kind published anywhere on the site. Nothing
      // it could be confused with, whether it appeared once or on every page.
      chosen.push({ ...best, confidence: 95 });
      continue;
    }

    if (runnerUp && runnerUp.pageCount >= best.pageCount) {
      ambiguous.push({ platform, handles: ranked.map((c) => c.handle) });
      continue;
    }

    // A clear winner among several. Confidence rises with how decisively it
    // leads, because a footer link on 40 of 42 pages is a stronger claim than
    // one on 3 pages against 2.
    const margin = best.pageCount / (best.pageCount + runnerUp!.pageCount);
    chosen.push({ ...best, confidence: Math.min(90, Math.round(60 + margin * 40)) });
  }

  return { chosen, ambiguous };
}
