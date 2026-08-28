"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Globe, ChevronDown, ExternalLink } from "lucide-react";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

/**
 * Page kinds in the words a customer would use.
 *
 * Singular and plural are both needed: the same kind heads a group ("Product
 * pages") and labels one row ("Product page"). OTHER is deliberately absent —
 * it means the crawler could not tell what kind of page it is, which is a fact
 * about our classifier and not about their site. Showing a customer a row
 * tagged "OTHER" tells them nothing they can act on, so those rows carry no
 * tag at all rather than a label that explains nothing.
 */
const KIND: Record<string, { one: string; many: string }> = {
  SERVICE: { one: "Service page", many: "Service pages" },
  PRODUCT: { one: "Product page", many: "Product pages" },
  LOCATION: { one: "Location page", many: "Location pages" },
  BLOG: { one: "Blog post", many: "Blog posts & articles" },
  CASE_STUDY: { one: "Case study", many: "Case studies" },
  FAQ: { one: "FAQ page", many: "FAQ pages" },
  ABOUT: { one: "About page", many: "About pages" },
  CONTACT: { one: "Contact page", many: "Contact pages" },
  HOME: { one: "Home page", many: "Home pages" },
};

/**
 * Something readable to call a page.
 *
 * Prefers the page's own title. Falling back to the raw URL is what made the
 * gap list unreadable — a column of
 * `https://indianfruitspulp.com/wp-content/uploads/2026/03/mangopulp-1.jpg`
 * is not something anyone can scan. The last part of the path, with its
 * separators turned into spaces, is almost always the page's subject:
 * `/guava-pulp/` reads as "Guava pulp", which is the whole point.
 */
function pageName(url: string, title: string | null | undefined): string {
  if (title?.trim()) return title.trim();
  try {
    const path = new URL(url).pathname.replace(/\/+$/, "");
    const slug = path.split("/").filter(Boolean).pop();
    if (!slug) return "Home page";
    const words = decodeURIComponent(slug).replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
    return words ? words.charAt(0).toUpperCase() + words.slice(1) : url;
  } catch {
    return url;
  }
}

/**
 * Drops the site's own name off the end of its page titles.
 *
 * Nearly every CMS appends it, so a list of one site's pages reads "Guava Pulp
 * - Indian Fruits Pulp / Mango Pulp - Indian Fruits Pulp / Papaya Pulp -
 * Indian Fruits Pulp" — the same eighteen characters on every row, pushing the
 * part that differs to the left of a fold on narrow screens.
 *
 * Derived from the titles themselves rather than from the domain, because what
 * a site calls itself in its title tag is often not its domain. A suffix is
 * only removed when most of the titles share it, so a genuine title that
 * happens to contain a dash is left alone.
 */
function siteSuffixStripper(titles: (string | null | undefined)[]): (title: string) => string {
  const present = titles.filter((t): t is string => Boolean(t?.trim()));
  if (present.length < 3) return (t) => t;

  const tails = new Map<string, number>();
  for (const title of present) {
    const match = title.match(/^(.*\S)\s+[-–—|:]\s+(\S.*)$/);
    if (match) tails.set(match[2], (tails.get(match[2]) ?? 0) + 1);
  }

  const [suffix, count] = [...tails].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  if (!suffix || count < present.length * 0.6) return (t) => t;

  return (title) => {
    const stripped = title.replace(new RegExp(`\\s+[-–—|:]\\s+${escapeRegExp(suffix)}$`), "");
    // Never return an empty string: a page genuinely titled with nothing but
    // the site name keeps it rather than rendering as a blank row.
    return stripped.trim() || title;
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Page coverage on both sides, for one competitor.
 *
 * The counts come from crawling both public sites and typing each page. That
 * is the whole basis of the claim shown here, and the copy says so — a number
 * on a dashboard with no stated source gets read as something more than it is.
 *
 * Nothing is rendered as zero when it was never measured. "We have not crawled
 * them" and "they publish nothing" look identical as a zero, and only one of
 * them is a reason to go and write pages.
 *
 * Written to be read by the customer, not by whoever built it. An earlier
 * version was accurate and unusable: it headed the list "69 pages with no
 * close match on yours", tagged every row `OTHER`, titled them with raw upload
 * URLs and explained each one as "nothing on your site shares a topic word
 * with this". Every one of those is a true statement about the algorithm and
 * none of them tells a business owner what they are looking at or what to do.
 */
export function CoverageComparison({
  projectId,
  competitorId,
  domain,
}: {
  projectId: string;
  competitorId: string;
  domain: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  const comparison = useQuery({
    queryKey: ["competitor-coverage", projectId, competitorId],
    queryFn: () => api.competitorComparison(projectId, competitorId),
    // A crawl takes minutes and finishes in the background, so the panel polls
    // rather than leaving a queued crawl looking like a failed one. Polling
    // stops once their side has arrived.
    refetchInterval: (query) => (queued && !query.state.data?.theirs ? 15_000 : false),
  });

  const crawl = useMutation({
    mutationFn: () => api.crawlCompetitorSite(projectId, competitorId),
    onSuccess: () => {
      setError(null);
      setQueued(true);
    },
    onError: (err) => setError(errorMessage(err)),
  });

  const data = comparison.data;
  const theirs = data?.theirs;
  const ours = data?.ours;

  return (
    <div className="mt-3 rounded-lg border bg-brand-50 px-4 py-3.5" style={{ borderColor: "var(--color-brand-100)" }}>
      {comparison.isLoading ? (
        <div className="flex items-center gap-2 text-[12px] text-brand-500">
          <Loader2 size={12} className="animate-spin" /> Loading coverage…
        </div>
      ) : !theirs ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12px] text-brand-600">
            {crawl.isPending || (queued && !theirs) ? (
              <span className="flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                Reading {domain}. This takes a few minutes — the results appear here on their own.
              </span>
            ) : (
              <>
                <span className="font-medium text-brand-950">We haven&apos;t looked at their site yet.</span>{" "}
                Read their public pages to see which topics they cover that you don&apos;t.
              </>
            )}
          </div>
          {!queued && (
            <button
              onClick={() => crawl.mutate()}
              disabled={crawl.isPending}
              className="flex items-center gap-1.5 rounded-md bg-brand-950 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
            >
              <Globe size={12} /> Analyze their site
            </button>
          )}
        </div>
      ) : (
        <div>
          {/* A sentence, not a stat line. "92 pages crawled on x · 35 on
              yours" is two numbers with a middot between them and leaves the
              reader to work out which is which. */}
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-[12px] text-brand-700">
              We read <strong className="font-semibold text-brand-950">{theirs.totalPages} pages</strong> on{" "}
              {domain}
              {ours ? (
                <>
                  {" "}
                  and <strong className="font-semibold text-brand-950">{ours.totalPages}</strong> on your site.
                </>
              ) : (
                "."
              )}
            </span>
            <button
              onClick={() => crawl.mutate()}
              disabled={crawl.isPending}
              className="text-[11px] font-medium text-brand-500 underline-offset-2 hover:underline disabled:opacity-60"
            >
              {crawl.isPending ? "Checking again…" : "Check again"}
            </button>
          </div>

          {/* Stated plainly rather than footnoted: a count from a crawl that
              stopped at its ceiling is a floor, and presenting it as their
              total would turn a limit we chose into a fact about their site. */}
          {theirs.capped && (
            <p className="mt-1 text-[11px] text-brand-500">
              Their site is bigger than we read in one go, so these are the pages we saw — not their whole site.
            </p>
          )}

          <RecentChanges projectId={projectId} competitorId={competitorId} />

          {!ours ? (
            <p className="mt-2.5 text-[12px] text-brand-600">
              We haven&apos;t read your own site yet, so there&apos;s nothing to compare against. Run a crawl under
              Website and this fills in.
            </p>
          ) : data.behindOn.length === 0 ? (
            <p className="mt-2.5 text-[12px] text-brand-600">
              You publish at least as many pages of every kind as they do.
            </p>
          ) : (
            <div className="mt-3">
              <div className="text-[12px] font-semibold text-brand-950">They publish more of these</div>
              <div className="mt-2 space-y-1.5">
                {data.behindOn.map((row) => (
                  <div key={row.pageType} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                    <span className="w-36 shrink-0 text-brand-700">
                      {KIND[row.pageType]?.many ?? row.pageType}
                    </span>
                    {/* Spelled out. "you 6 → them 24" needs decoding; this
                        does not. */}
                    <span className="text-brand-500">
                      you have {row.ours}, they have {row.theirs}
                    </span>
                    <span className="rounded-full bg-accent-600/10 px-2 py-0.5 text-[11px] font-medium text-accent-600">
                      {row.gap} more
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Opportunities projectId={projectId} competitorId={competitorId} />
        </div>
      )}

      {error && <p className="mt-2 text-[11px] text-error-500">{error}</p>}
    </div>
  );
}

/**
 * What moved on their site since the crawl before this one.
 *
 * Renders nothing at all until there have been two crawls. A first crawl
 * diffed against nothing would read as "they added 35 pages", announcing the
 * site's whole existence as this week's news, and an empty "no changes" box
 * would say we checked when we did not.
 */
function RecentChanges({ projectId, competitorId }: { projectId: string; competitorId: string }) {
  const changes = useQuery({
    queryKey: ["competitor-changes", projectId, competitorId],
    queryFn: () => api.competitorChanges(projectId, competitorId),
  });

  const data = changes.data;
  if (!data) return null;

  const moved = data.added.length + data.removed.length + data.retitled.length;
  if (moved === 0) return null;

  const since = data.since ? new Date(data.since).toLocaleDateString() : null;
  const strip = siteSuffixStripper(data.added.map((p) => p.title));

  return (
    <div className="mt-3 border-t pt-2.5" style={{ borderColor: "var(--color-brand-100)" }}>
      <div className="text-[12px] font-semibold text-brand-950">
        What they changed since {since ?? "we last looked"}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {data.added.length > 0 && (
          <span className="rounded-full bg-[#10b98118] px-2 py-0.5 text-[11px] text-success-500">
            {data.added.length} new {data.added.length === 1 ? "page" : "pages"}
          </span>
        )}
        {data.removed.length > 0 && (
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] text-brand-600">
            {data.removed.length} taken down
          </span>
        )}
        {data.retitled.length > 0 && (
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] text-brand-600">
            {data.retitled.length} retitled
          </span>
        )}
      </div>
      {/* The pages themselves, not just a count — "they added 6 pages" is a
          notification, "they added 6 service pages for cities you don't cover"
          is something to act on. Capped so one big relaunch cannot push the
          rest of the panel off the screen. */}
      {data.added.length > 0 && (
        <ul className="mt-2 space-y-1">
          {data.added.slice(0, 5).map((page) => (
            <li key={page.url} className="truncate text-[11px] text-brand-600">
              {strip(pageName(page.url, page.title))}
              {KIND[page.pageType] && (
                <span className="text-brand-400"> · {KIND[page.pageType].one.toLowerCase()}</span>
              )}
            </li>
          ))}
          {data.added.length > 5 && (
            <li className="text-[11px] text-brand-400">and {data.added.length - 5} more</li>
          )}
        </ul>
      )}
    </div>
  );
}

/**
 * Their pages with no close counterpart on the customer's site.
 *
 * Every row shows the closest thing found on the customer's own site and how
 * close it was. That is not a detail: matching is done on words in the URL and
 * title, which is right often enough to be worth showing and wrong often
 * enough that a bare "you are missing this" would be a claim the data does not
 * support. Showing the near-miss lets the reader see at a glance when they
 * already cover the topic in different wording.
 *
 * Open by default, and grouped by kind. It used to be collapsed behind a
 * chevron, which is the same complaint the content strategy page drew — the
 * findings a customer came for should not need a click to appear. It closes,
 * for when the list is long and in the way, but it does not start closed.
 */
function Opportunities({ projectId, competitorId }: { projectId: string; competitorId: string }) {
  const [open, setOpen] = useState(true);

  const query = useQuery({
    queryKey: ["competitor-opportunities", projectId, competitorId],
    queryFn: () => api.competitorOpportunities(projectId, competitorId),
  });

  const data = query.data;
  if (!data || data.total === 0) return null;

  // Grouped so the list reads as a few topics rather than one long column.
  // Their kinds, in the order the API returned them — which is weakest match
  // first, so the least-covered topics head the list.
  const groups = new Map<string, typeof data.opportunities>();
  for (const item of data.opportunities) {
    const bucket = groups.get(item.pageType) ?? [];
    bucket.push(item);
    groups.set(item.pageType, bucket);
  }

  // Two sites, two suffixes: theirs on the page names, the customer's own on
  // the "closest thing on your site" line beneath each.
  const theirTitle = siteSuffixStripper(data.opportunities.map((o) => o.title));
  const ourTitle = siteSuffixStripper(data.opportunities.map((o) => o.closestOwnPage?.title));

  return (
    <div className="mt-3 border-t pt-2.5" style={{ borderColor: "var(--color-brand-100)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-left text-[12px] font-semibold text-brand-950"
      >
        <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
        {data.total} {data.total === 1 ? "topic they cover" : "topics they cover"} that we couldn&apos;t find on
        your site
      </button>

      {open && (
        <>
          {/* The method, in a sentence a reader can weigh, stated where the
              list is read rather than in a tooltip. A list headed "gaps" with
              no stated basis gets treated as fact; this one is a word-overlap
              heuristic and says so. */}
          <p className="mt-1.5 text-[11px] leading-relaxed text-brand-500">
            We compared the words in each page&apos;s title and web address. If you cover one of these in different
            wording, we may have missed it — so read this as a list worth checking, not a list of mistakes.
          </p>

          <div className="mt-2.5 space-y-3">
            {[...groups].map(([pageType, items]) => (
              <div key={pageType}>
                {KIND[pageType] && (
                  <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-brand-400">
                    {items.length === 1 ? KIND[pageType].one : KIND[pageType].many}
                  </div>
                )}
                <ul className="mt-1 space-y-1.5">
                  {items.map((item) => (
                    <li key={item.url}>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex max-w-full items-center gap-1 text-[12px] font-medium text-brand-950 underline-offset-2 hover:underline"
                      >
                        <span className="truncate">{theirTitle(pageName(item.url, item.title))}</span>
                        <ExternalLink size={10} className="shrink-0 text-brand-300 group-hover:text-brand-500" />
                      </a>
                      {item.closestOwnPage ? (
                        <div className="truncate text-[11px] text-brand-500">
                          Closest thing on your site:{" "}
                          {ourTitle(pageName(item.closestOwnPage.url, item.closestOwnPage.title))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-brand-500">Nothing similar on your site.</div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
