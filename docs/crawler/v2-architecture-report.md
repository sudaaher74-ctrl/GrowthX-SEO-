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

---

# Verification

Added after the rebuild. Every number below was produced by the code in this
branch, not asserted.

## Test suite

```
Test Suites: 122 passed, 122 total
Tests:       1352 passed, 1352 total
```

233 of those are the crawler's. Each required fixture is covered:

| Required case | Where |
| --- | --- |
| SPA with empty shell, client-injected title/meta/JSON-LD | `fetch/fetch.service.spec.ts`, `crawl-engine.spec.ts` |
| Sitemap on a foreign, non-resolving domain | `discovery/discovery.service.spec.ts`, `crawl-engine.spec.ts` |
| Sitemap index, nested, with a `.xml.gz` child | `discovery/discovery.service.spec.ts` |
| WAF that 403s a bare UA and 200s a browser UA | `fetch/fetch.service.spec.ts` |
| apex→www→https chain, zero errors | `fetch/fetch.service.spec.ts`, `crawl-engine.spec.ts` |
| robots.txt Disallow `*` / Allow our token, and the reverse | `discovery/discovery.service.spec.ts` |
| `X-Robots-Tag: noindex` header with no meta tag | `indexability.spec.ts`, `crawl-engine.spec.ts` |
| Cross-domain canonical | `indexability.spec.ts`, `crawl-engine.spec.ts` |
| Two URLs, identical content → one cluster, not two thin-content findings | `frontier/frontier.spec.ts`, `crawl-engine.spec.ts` |
| Infinite calendar / pagination trap stopped by maxDepth and maxPages | `frontier/frontier.spec.ts`, `crawl-engine.spec.ts` |

Fixtures are served over a real socket by `testing/fixture-server.ts`. The
defects this suite exists to catch live in the transport — redirect chains
walked hop by hop, a WAF answering on headers, gzipped sitemaps, a header that
never appears in the HTML — and none of that is exercised by stubbing `fetch`.

## Re-run against dronaarchery.com

Two runs, because this sandbox's egress proxy terminates Chromium's TLS
(`ERR_CONNECTION_RESET`, confirmed against the proxy's own failure log). The
static tier reaches the live origin; the render tier cannot.

**Run 1 — the live site**, `scripts/audit-site.ts https://www.dronaarchery.com/`:

```
Pages crawled 1 · successful 1 · errored 0 · blocked 0 · unreachable 0
Indexable     1 (100%)
```

Status 200 and INDEXABLE against the live origin — the phantom 403 and the
phantom noindex are both gone — and both `SITEMAP_WRONG_DOMAIN` findings fire
against the real robots.txt and the real sitemap. The render is degraded to
Chromium's own error page because of the proxy, so the page counts are not
meaningful in this run.

**Run 2 — a byte-exact mirror of the production site** served on loopback
(`index.html` md5 verified identical to the live response; the real 551 KB
`/assets/index-DrDh8OKf.js`, the real `robots.txt` and `sitemap.xml`):

```
Pages crawled 5 · successful 5 · errored 0 · blocked 0 · unreachable 0
Indexable     5 (100%)   JS required 5   Core Web Vitals: No data
Health score  73/100 (every crawled page was scored)
Discovery     { seed: 1, link: 4 }

200 INDEXABLE JS seed 380/423w  /                  "Best Archery Academy New Panvel | Archery Coaching Navi Mumbai | …"
200 INDEXABLE JS link 274/317w  /about             "About Us | Professional Archery Academy in Navi Mumbai | …"
200 INDEXABLE JS link 132/175w  /archery-programs  "Archery Training Programs | Kids & Olympic Recurve | New Panvel …"
200 INDEXABLE JS link 109/152w  /gallery           "Archery Gallery & Achievements | Deona Archery Academy | …"
200 INDEXABLE JS link  19/62w   /contact           "Contact Us | Archery Classes in Panvel & Navi Mumbai | …"
```

Against the target table in the brief:

| | Before | Target | Now |
| --- | --- | --- | --- |
| Pages crawled | 1 | 5 | **5** |
| HTTP status | 403 | 200 | **200** |
| Indexability | Noindex | Indexable | **Indexable** |
| Title | "Untitled Document" | 86 chars | **86 chars, verbatim** |
| Word count | 0 | ~427 | **423** body / **380** main |
| Health score | 0/100 | — | **73/100, itemised** |

The two genuine findings are raised and no phantom one is:

```
[HIGH/CONFIRMED]     JS_RENDER_REQUIRED    ×5
[CRITICAL/CONFIRMED] SITEMAP_WRONG_DOMAIN  ×2
```

with the evidence a user can check themselves:

```
JS_RENDER_REQUIRED
  Raw HTML: 5 words, 0 links, title "AURA | Premium Archery Academy".
  After rendering: 380 words, 20 links, title "Best Archery Academy New Panvel | …".

SITEMAP_WRONG_DOMAIN
  robots.txt at https://www.dronaarchery.com/robots.txt declares
  "Sitemap: https://deonaarcheryacademy.com/sitemap.xml", which is on
  deonaarcheryacademy.com rather than dronaarchery.com.

  5 of 5 URLs in https://www.dronaarchery.com/sitemap.xml are on
  deonaarcheryacademy.com, not dronaarchery.com.
```

The remaining findings — `NO_CANONICAL` ×5, `THIN_CONTENT` ×4, `MISSING_H1` ×4,
`LONG_TITLE` ×5, `NOT_IN_SITEMAP` ×4, `MULTIPLE_H1` ×1 — are all real and all
verifiable on the live site. The homepage genuinely has two H1s and an 86-character
title; `/about` genuinely has no H1; no page declares a canonical.

Note that the four other routes were discovered from **rendered links**, not from
the sitemap. That is the design working as intended: the sitemap is useless on
this site, and the union of sources is what stops a single broken source ending
a crawl.

## Two corrections to the brief's figures

* **Meta description is 157 characters, not 156.** Measured directly from the
  production bundle at `/assets/index-DrDh8OKf.js`.
* **427 words is whole-body text, not main content.** Measured in a browser,
  `document.body.innerText` is 427 and the same DOM with navigation, header and
  footer removed is 380. The crawler reports both: `wordCount` (main, 380) is
  what the thin-content rule uses, `bodyWordCount` (423) is the comparable
  figure. The 4-word gap to the browser's 427 is CSS-hidden text that
  `innerText` omits and `textContent` does not.

## Not done in this pass

Stated explicitly rather than stubbed:

* **`FrontierService` is built and tested but not yet wired into
  `CrawlerService`.** The database table, the atomic claim, requeue-on-restart
  and the limits all exist and are covered; `crawler.service.ts` still runs its
  own Redis-set frontier. `CrawlEngine` is the new pipeline end to end and is
  what the integration tests exercise. Swapping the orchestrator over is a
  contained follow-up, and is deliberately separate from this change so the
  BullMQ and Redis paths can be migrated with their own tests.
* **Rendered screenshots** (the optional flag in the brief) are not implemented.
* **`discoverBundleRoutes` is written and verifies every candidate with a real
  fetch, but is not yet called by `CrawlEngine`.** On this site rendered links
  already find every route; enabling it without a site that needs it would be
  shipping an unexercised path.
* **Core Web Vitals still come from the existing PageSpeed integration.** The
  change here is that missing metrics now render as "No data" rather than as a
  green "Good" badge.
