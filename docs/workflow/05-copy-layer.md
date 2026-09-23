# Task 5 — Rewrite all 25 issue types for someone who doesn't know what a meta tag is

> Paste this whole file into Claude Code as your prompt, from the repo root.
> Independent of task 6. Assumes tasks 1–4.
> Backend paths are relative to `growthx-ai-crawler/`.

## Goal

The product's stated goal is that a non-technical business owner can run it.
Today a queue row reads:

> **SCHEMA PRODUCT OFFERS** — `https://www.aivaenterprises.com/products/tomato`
> Missing `offers` property in Product schema. **HIGH**

Nobody outside SEO knows what that means or whether to click. This task adds a
presentation layer that turns every finding into three sentences, and costs
nothing but discipline.

## The three-sentence rule

Always these three, always in this order:

| Sentence | Answers | Rule |
|----------|---------|------|
| **1 · What's wrong** | "What is broken, in my words?" | No SEO vocabulary at all — no *schema*, *canonical*, *H1*, *crawl budget*, *indexation*, *GEO*. Name the business consequence, not the technical fact. Lead with the count |
| **2 · What it costs** | "Why should I care today?" | Tie to traffic, money or reputation using a real Search Console number. **If there is no number, say so.** Never invent one |
| **3 · What we'll do** | "What happens if I click?" | What changes, what does **not** change, how long, and that it is reversible. Fear of breaking the site is the number one reason auto-fix goes unused |

Keep the technical string. Put `issueType`, `dedupKey`, affected URLs and raw
evidence behind a **Technical details** expander. The agency owner never opens
it; the agency's developer opens it every time. Both are served.

## Implementation

New file `src/modules/issues/issue-copy.ts`:

```ts
export interface IssueCopy {
  /** Sentence 1. `{n}` is replaced with affectedCount. */
  title: string;
  /** Sentence 2. `{traffic}` replaced with the GSC share, or the whole clause
   *  dropped when reach is unavailable. */
  cost: string;
  /** Sentence 3. */
  action: string;
  fixClass: 'AUTO' | 'APPROVAL' | 'MANUAL';
  /** Shown only in the Technical details expander. */
  technical: string;
}

export const ISSUE_COPY: Record<string, IssueCopy> = { /* table below */ };

export function renderCopy(
  issueType: string,
  ctx: { n: number; traffic?: number | null },
): { title: string; cost: string; action: string } {
  // {n} -> ctx.n, pluralise "page"/"pages"
  // {traffic} -> `${ctx.traffic}% of your search traffic`
  // when ctx.traffic is null, drop the sentence containing {traffic} and
  // fall back to the type's trafficless variant — never print "null%".
}
```

Wire `renderCopy` into `IssueGroup` (task 2) and the `WebsiteAuditAdapter`
(task 3) so `title`, `summary` and `recommendedAction` are populated at the
source. The frontend renders strings; it never builds them.

A unit test must assert **every** `issueType` emitted by
`issue-engine.service.ts` has an entry in `ISSUE_COPY`. That test is what stops
this decaying the next time someone adds a check.

## The table — all 25 types

Copy these verbatim. `{n}` = affected page count, `{traffic}` = GSC traffic share.

| issueType | Title (sentence 1) | Cost (sentence 2) | Action (sentence 3) | fixClass |
|---|---|---|---|---|
| `MISSING_TITLE` | {n} pages have no name in Google search results | These pages get {traffic}. Google invents a title from whatever text it finds, and it is usually wrong | We'll write a clear title for each page using what the page is actually about. This shows in the browser tab and in search results — nothing on the page itself changes. Reversible any time | AUTO |
| `LONG_TITLE` | {n} page titles get cut off halfway in Google | Shoppers see "Fresh Organic Tomatoes — Best Quality Whole…" and can't tell what you sell. These pages get {traffic} | We'll shorten each title to fit, keeping the important words at the front. Your page content doesn't change | AUTO |
| `SHORT_TITLE` | {n} page titles are too short to tell Google what the page is | A two-word title competes badly against a competitor's descriptive one. These pages get {traffic} | We'll expand each title with what the page actually covers. Nothing on the page changes | AUTO |
| `DUPLICATE_TITLE` | {n} pages share the same name in search results | Google can't tell these pages apart and often shows only one of them, so the rest never appear | We'll make each title specific to its own page. Page content is untouched | AUTO |
| `MISSING_META_DESCRIPTION` | {n} pages let Google write their own description — usually badly | The grey text under your link in search results is your sales pitch. Right now Google picks a random sentence. These pages get {traffic} | We'll write a short description for each page that says what's on it and why to click. Invisible on your site, visible in Google | AUTO |
| `LONG_META_DESCRIPTION` | {n} search descriptions get cut off mid-sentence | Your pitch ends in "…" before it reaches the point | We'll trim each to fit, keeping the strongest part. Nothing on your site changes | AUTO |
| `MISSING_ALT_TEXT` | {n} images are invisible to Google and to blind visitors | Image search sends free traffic you're not collecting, and screen readers skip these entirely — which is also an accessibility risk | We'll describe each image in a short line of hidden text. Your images look exactly the same | AUTO |
| `MISSING_CANONICAL` | {n} pages don't tell Google which version is the real one | When the same page is reachable by several addresses, Google splits the credit between them and all versions rank worse | We'll mark the main version of each page. Invisible to visitors | AUTO |
| `BROKEN_CANONICAL` | {n} pages point Google at a page that doesn't exist | Google is being told "the real version of this page is over there" — and there is nothing there, so it may drop the page entirely | We'll point each page at itself or at the correct version | AUTO |
| `CANONICAL_CROSS_DOMAIN` | {n} pages tell Google the real version is on someone else's website | You are handing your search credit to another domain. If this wasn't deliberate, it is costing you every ranking on those pages | We'll point each page back to your own site. Flagged for your confirmation first if the other domain is one of yours | APPROVAL |
| `NOT_IN_SITEMAP` | {n} pages aren't on the map you give Google | Google may take weeks to find these pages, or never find them. New pages suffer most | We'll add them to your sitemap. Nothing visible changes | AUTO |
| `NOINDEX_DETECTED` | {n} pages are telling Google not to show them at all | These pages cannot appear in search results, no matter how good they are. Often left over from a site build | We'll remove the instruction after you confirm each page should be public — some pages are hidden on purpose | APPROVAL |
| `INCORRECT_ROBOTS` | Your site is blocking Google from parts of it | Anything blocked cannot rank. This is a site-wide setting, so the damage is broad | We'll propose a corrected rules file for your approval. This one is worth a careful look before it ships | APPROVAL |
| `MISSING_H1` | {n} pages have no headline | The main heading tells both visitors and Google what the page is about in one line. Without it, both are guessing. These pages get {traffic} | We'll add a headline to each page. **This is visible on your site**, so you'll see a preview and approve it first | APPROVAL |
| `MULTIPLE_H1` | {n} pages have several competing headlines | When everything is the headline, nothing is. Google can't work out the page's main subject | We'll keep the most relevant one as the headline and demote the rest. Visible change — you'll approve a preview | APPROVAL |
| `BROKEN_LINK_4XX` | {n} links on your site lead to pages that don't exist | Visitors hit a dead end and leave. Google reads broken links as a sign the site is unmaintained | We'll show you each broken link with a suggested replacement, and fix them once you confirm | APPROVAL |
| `BROKEN_IMAGE` | {n} images don't load | Visitors see a broken icon where a product photo should be. On a product page this kills the sale | We'll list each one so you can re-upload, and remove any that are genuinely gone | APPROVAL |
| `REDIRECT_CHAIN` | {n} pages bounce visitors through several addresses before arriving | Every extra hop slows the page and leaks a little ranking strength. On mobile this is felt | We'll point the first address straight at the final one | APPROVAL |
| `REDIRECT_LOOP` | {n} pages send visitors round in circles and never load | These pages are completely unreachable — for visitors and for Google | This needs a look at your redirect rules, which usually live in your hosting settings. We'll show you exactly which rules conflict | MANUAL |
| `SERVER_ERROR_5XX` | {n} pages are returning an error instead of loading | Your server is failing on these pages. If Google keeps hitting errors it stops crawling the site as often | This is a hosting or application problem we can't patch from here. We'll show you the failing addresses and the error so your developer can act | MANUAL |
| `MIXED_CONTENT` | {n} secure pages are loading insecure content | Browsers show a "not secure" warning, and some block the content outright. On a checkout page this loses orders | We'll switch each insecure reference to its secure version. Visual check before it ships | APPROVAL |
| `HTTPS_ISSUE` | Your site's security certificate has a problem | Visitors may see a full-page browser warning before they reach you. Almost nobody clicks past that | This is fixed with your hosting provider, not in your site's code. We'll show you exactly what's wrong so you can pass it on | MANUAL |
| `LARGE_HTML` | {n} pages are unusually heavy and slow to load | Slow pages lose visitors before they see anything, and Google uses speed as a ranking signal. Worst on mobile data | We'll identify what's making each page heavy and propose specific reductions for your approval | APPROVAL |
| `THIN_CONTENT` | {n} pages have too little content to rank for anything | Google treats near-empty pages as low value, and having many of them can drag down the whole site | We'll draft fuller content for each page. **You review and publish** — we never publish words in your voice without you reading them | MANUAL |
| `URL_STRUCTURE_ISSUE` | {n} page addresses are hard for people and Google to read | Addresses full of codes and numbers get fewer clicks than readable ones and say nothing about the page | We'll propose cleaner addresses with redirects from the old ones, so no existing link breaks. Approve before it ships | APPROVAL |

### The dynamic `SCHEMA_*` namespace

The 25 types in the table are the complete set emitted as string literals by
`issue-engine.service.ts`. They are **not** the complete set the queue shows.
`src/modules/ai/fix-generator.ts` also produces types named
`SCHEMA_<schemaType>_<PROPERTY>` — `SCHEMA_PRODUCT_OFFERS` is the one filling the
Aiva priority queue in task 2's bug report. These are generated, so no static
table can enumerate them.

Handle them with a pattern fallback rather than 25 more rows:

- `renderCopy` matches `/^SCHEMA_(.+?)_(.+)$/` and builds copy from the two
  captures — "{n} product pages don't tell Google the price and stock status",
  with `fixClass: 'AUTO'` (structured data is invisible to visitors).
- The completeness test asserts every **static** literal has a table entry, and
  separately that a representative `SCHEMA_*` type renders all three sentences
  with no leftover `{}` placeholders and no raw underscored token in the output.

### Beyond the crawler

The other three detectors need the same treatment. Add these to their adapters
in task 3:

| Finding | Title | Cost | Action |
|---|---|---|---|
| AI Visibility — brand absent | ChatGPT names {n} competitors when asked about "{prompt}", and never you | People increasingly ask an AI instead of searching. In this category you currently don't exist in that answer | We'll draft the page and the facts these tools look for when answering this question. You review before it's published |
| GBP — no recent posts | Your Google listing has been silent for {n} days | Google favours active listings in the local map results, and a stale listing looks closed | We'll draft posts for you. One click to publish each |
| GBP — unanswered reviews | {n} reviews have no reply | Replying publicly is the cheapest reputation work there is, and Google counts engagement | We'll draft a reply to each in your tone. You read it and send it |
| Competitor — keyword gap | {competitor} shows up for {n} searches where you have no page at all | These are customers actively looking for what you sell, going somewhere else | We'll write a brief for each page worth creating, ranked by how much traffic it could bring |

## Style rules

- **Lead with the number.** "{n} pages…" every time. Scale is what makes someone act.
- **Second person, active voice.** "Your listing", "we'll write", never "the
  meta description should be optimised".
- **Never promise a ranking outcome.** "This helps Google understand the page",
  never "this will get you to page one".
- **Say what does not change.** For every AUTO fix, state explicitly that the
  page looks the same. This single sentence is what gets auto-fix switched on.
- **Be honest about missing data.** With no Search Console connection, the cost
  sentence becomes "We can't measure how much traffic this affects until
  Search Console is connected" — never a guessed percentage.
- **Never say the product found "issues".** Say what's wrong. "Issues" is a
  number that scares people without telling them anything.

## Acceptance criteria

- [ ] All 25 types have entries; the completeness test passes.
- [ ] No string in `ISSUE_COPY` contains: schema, canonical, H1, meta, crawl,
      index, SERP, GEO, LLM, 4XX, 5XX — outside the `technical` field. Write a
      lint test for this list.
- [ ] `{traffic}` never renders as `null`, `undefined` or `NaN`.
- [ ] Pluralisation is correct at `n = 1` ("1 page has", not "1 pages have").
- [ ] Every queue row has at most three controls.
- [ ] The Technical details expander still exposes the raw `issueType`,
      `dedupKey`, evidence and full URL list.

## Tests to add

`src/modules/issues/issue-copy.spec.ts`
- Every `issueType` in `issue-engine.service.ts` has copy. Derive the list by
  reading the source, so a new check without copy fails the build.
- Jargon blocklist test over `title`, `cost` and `action`.
- `renderCopy` with `traffic: null` produces no placeholder artefacts.
- `n = 1` pluralisation.
