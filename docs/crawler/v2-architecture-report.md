# Crawler v2 — current architecture and root-cause report

Written before any code changed. Every claim below is either a file:line citation
or a live measurement taken from this container on 2026-09-14.

## 1. What exists today

The audit pipeline is a NestJS module tree in `growthx-ai-crawler/`, orchestrated by a
single 979-line service. Stack reality differs from the brief in two places, and this
rebuild keeps the repo's choices rather than churning them:

| Brief assumed | Repo actually uses |
| --- | --- |
| Puppeteer | **Playwright** (`playwright@^1.46.1`) |
| undici | **axios** for all fetches (Node 22's built-in undici `fetch` is used for the new static tier) |

### Module map

| Path | Lines | Role |
| --- | --- | --- |
| `src/modules/crawler/crawler.service.ts` | 979 | Orchestrator: seeds, BFS, page upsert, issue dispatch, job completion |
| `src/modules/crawler/fetcher.service.ts` | 345 | Hybrid axios→Playwright fetch |
| `src/modules/crawler/crawler.processor.ts` | 97 | BullMQ workers |
| `src/modules/crawler/crawl.controller.ts` | 522 | REST surface |
| `src/modules/crawler/canonical-url.ts` | 34 | Dedup key canonicalisation |
| `src/modules/crawler/crawlable.ts` | 77 | Extension / content-type gate |
| `src/modules/crawler/page-type.ts` | 114 | HOME/SERVICE/PRODUCT/... classifier |
| `src/modules/sitemap/sitemap.service.ts` | 156 | Sitemap discovery + parse |
| `src/modules/robots/robots.service.ts` | 187 | robots.txt fetch + path matching |
| `src/modules/extractor/html-extractor.service.ts` | 122 | Title/meta/canonical/headings/JSON-LD |
| `src/modules/analyzer/*.ts` | ~780 | Content, link, image, schema analysis |
| `src/modules/issues/issue-engine.service.ts` | 646 | 25 issue rules + persistence |
| `src/modules/issues/health-score.util.ts` | 162 | Severity-weighted score |
| `src/modules/queue/queue.service.ts` | — | BullMQ queues + Redis pending-task counter |

Frontier state lives in **Redis and worker memory only** — `localVisited`
(`crawler.service.ts:31`), `jobSitemapUrls` (`:32`), `jobStats` (`:36`) and the Redis
set `job:<id>:visited` (`:687`). Nothing is persisted, so a worker restart abandons a
crawl; `finalizeStalledJobs` (`:110-145`) exists purely to sweep up the corpses.

## 2. Live ground truth for https://www.dronaarchery.com/

Measured from this container:

```
GET https://www.dronaarchery.com/   → 200, server: Vercel, 803 bytes, no X-Robots-Tag
  … with a browser UA           → 200
  … with GrowthX-AI-Bot/1.0     → 200      ← the origin is NOT blocking our UA
GET https://dronaarchery.com/       → 200 after redirect to https://www.dronaarchery.com/
GET /robots.txt                     → 200, "User-agent: *  Allow: /"
                                       Sitemap: https://deonaarcheryacademy.com/sitemap.xml
GET /sitemap.xml                    → 200, 5 URLs, all on deonaarcheryacademy.com
DNS deonaarcheryacademy.com         → does not resolve
```

Rendered with Chromium against a byte-exact local mirror of the production bundle:

```
title       "Best Archery Academy New Panvel | Archery Coaching Navi Mumbai | Drona Archery Academy" (86)
description 156 chars, present
meta robots ABSENT      canonical ABSENT
h1 2   h2 7   words 427   images 6 (0 missing alt)
JSON-LD     LocalBusiness, SportsActivityLocation, SportsOrganization, FAQPage
links       / /about /archery-programs /gallery /contact + wa.me, mailto:, tel:, instagram, facebook
```

Every figure in the brief reproduces exactly. The raw `<title>` is the Vite placeholder
`AURA | Premium Archery Academy`; the real title is injected by React.

## 3. Root causes, located

### RC-1 — No JavaScript rendering reaches the parser

`fetcher.service.ts:308-330` `needsDynamicRendering()` *does* detect the SPA shell, and
`:206-212` *does* escalate to Playwright. Two things defeat it:

* `ensurePlaywrightInitialized()` (`:66-110`) is lazy by default
  (`ENABLE_PLAYWRIGHT_STARTUP !== 'true'`, `:57-63`) and **fails open**: when Chromium
  cannot launch it returns `false` (`:105-107`) and the caller silently falls through to
  the 803-byte static body (`:208-211`). No flag records that rendering was skipped, so
  every downstream metric is computed from the empty shell with no indication why.
* The settle is a blind `waitForTimeout(1000)` (`:270`) after `domcontentloaded` — not
  `networkidle2`, and no wait for `a[href]`. A Vite bundle of 551 KB does not hydrate in
  1 s on a 512 MB Render instance, so even the successful path can capture an empty DOM.

There is no `rawHtml`/`renderedHtml` split and no `jsRequired` column — the two are
never compared, so the single highest-value finding on this site is invisible.

### RC-2 — Sitemap is parsed but its URLs are unusable, and the failure is silent

`crawler.service.ts:222-236` does seed from the sitemap. The sitemap returns 5 URLs —
all on `deonaarcheryacademy.com`. They are added to `seedUrls` verbatim
(`:227-230`), then every one of them fails DNS at fetch time. `SitemapService` never
compares the sitemap's host to the crawl target (`sitemap.service.ts:100-145`), so:

* 5 dead seeds are enqueued and silently dropped,
* `sitemapFound: true` is reported (`crawler.service.ts:836`),
* the frontier is left with the homepage alone,
* and because RC-1 left that homepage with zero `<a>` tags, BFS has nothing to expand.

That is the exact "1 page crawled" in the screenshot. `SitemapService` also lacks
`.xml.gz` support, `xhtml:link` hreflang, and the fallback paths
`/sitemap-index.xml`, `/wp-sitemap.xml`, `/sitemap/sitemap.xml` (`:48-50` tries only two).

### RC-3 — The 403 is fabricated inside our own pipeline

The origin returns 200 to every user agent tested. The crawler has exactly one place
that mints a 403 out of nothing:

* **`fetcher.service.ts:138-149`** — the SSRF guard wraps `new URL()` *and* its own
  `throw` in one `try`, and the `catch` returns `statusCode: 403` for **any** exception,
  including a malformed-URL parse failure that has nothing to do with the origin. An
  internal fault is written to the page row as if the site had said no.

Two more paths convert our failures into the page's status without ever saying so:

* `fetcher.service.ts:227-236` — a transport failure (DNS, TLS, timeout, proxy) becomes
  `statusCode: 500`.
* `fetcher.service.ts:246-249, 284-292` — a Playwright crash becomes `statusCode: 500`.

And the Playwright status listener itself is unreliable: `:252-262` overwrites
`statusCode` from *any* response whose URL happens to equal `page.url()` at event time,
which on a client-routed SPA is not necessarily the document response.

Whatever fired in production — a Vercel edge 403 on a datacenter IP is the most likely
external candidate, and `blockedSuspected` exists in v2 precisely so that becomes
evidence rather than an assertion — the defect is structural: **there is no type in the
system that distinguishes "the origin said 403" from "we failed".** `FetchError`
with a `kind` discriminator is that type.

### RC-4 — Indexability is inferred from the status code

There is **no indexability field anywhere in the backend**. The Pages tab computes it in
the browser:

* `growthx-ai-seo/src/components/website/tabs/pages-tab.tsx:107-119`
  ```ts
  pages.filter((p) => p.statusCode >= 400 || issues.some(... "NOINDEX" ...))
  ```
* `technical-seo-tab.tsx:96-104` repeats it with `noindexIssues.length + errorPagesCount`.

So the phantom 403 alone produced `Noindex` and `0% indexable`. The page carries no
meta robots, no `X-Robots-Tag` and no canonical — by the correct rule it is plainly
indexable. There is also no `unknown` state: a signal we failed to read renders
identically to a signal we read as "no".

### RC-5 — One bad status spawns six bogus issues, and the UI disagrees with itself

`issue-engine.service.ts` runs its content rules unconditionally, while
`crawler.service.ts:411-417` only populates `htmlData` when `statusCode === 200`. The
combination is the cascade. For this page it produces precisely the five issues on the
screenshot:

| Rule | Line | Severity |
| --- | --- | --- |
| `MISSING_TITLE` | `:57-69` | CRITICAL (homepage) |
| `BROKEN_LINK_4XX` | `:332-347` | CRITICAL |
| `MISSING_H1` | `:206-219` | HIGH |
| `MISSING_META_DESCRIPTION` | `:111-124` | MEDIUM |
| `MISSING_CANONICAL` | `:147-160` | MEDIUM |

Critical 2 / High 1 / Medium 2 — an exact match for the donut in the screenshot. Four of
the five are artefacts of the first.

The UI contradictions are two different formulas for one number:

* **Crawlability 100%, 0 blocked** — `technical-seo-tab.tsx:69-71` reads
  `qualityDiagnostics.robotsBlocked`, which is 0 because robots.txt allows everything.
* **1 Blocked** — `pages-tab.tsx:105` reads `statusCode >= 400`.
* **Core Web Vitals "Good" with no data** — `technical-seo-tab.tsx:125-127`:
  `avgLcpMs == null ? "Good" : ...`. Missing data is scored as passing.

## 4. What v2 changes

| Root cause | Fix |
| --- | --- |
| RC-1 | `FetchService` two tiers, warm browser pool, explicit escalation predicate, `networkidle` + `a[href]`/3 s settle, `rawHtml`/`renderedHtml`/`jsRequired` persisted, `JS_RENDER_REQUIRED` issue |
| RC-2 | `DiscoveryService` unions robots + sitemap (index nesting, `.xml.gz`, hreflang) + fallback paths + rendered links + bundle routes; `SITEMAP_WRONG_DOMAIN` / `SITEMAP_DEAD_URLS` |
| RC-3 | Typed `FetchError { kind }`, header escalation on 403/429/503, `blockedSuspected` with evidence, redirect chain captured hop-by-hop, apex↔www normalised |
| RC-4 | `computeIndexability()` — status + robots.txt + meta robots + X-Robots-Tag + canonical, nothing else, with an explicit `unknown` |
| RC-5 | Cascade suppression on fetch failure, evidence/confidence on every issue, one shared `computeCrawlSummary()` for both tabs, "No data" for absent CWV |
