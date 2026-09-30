# GrowthX landing page: content analysis and plan

Written 30 Sep 2026 from the code at `main` (HEAD `f5efce0`). Every "the page
says" line was read from `growthx-ai-seo/src/components/marketing/*` and
`app/(marketing)/*`. Every "the product does" line was read from
`growthx-ai-crawler/` (schema, services, schedulers) or `docs/`. Nothing here is
from memory of how the product is supposed to work.

> **Status, 30 Sep 2026.** Decisions made: prices are ₹2,999 / ₹7,999 / ₹14,999
> (Starter / Growth / Agency); main users are agencies and business owners; no
> Shopify/WordPress publishing (Fix Engine stays GitHub-PR only). The P0 and P1
> items in §11, and the new Prove-it and Safety-rules sections, are implemented
> in `growthx-ai-seo`. Still open: real logo permissions, live counters, real
> screenshots and a case study (§9), and whether the TREAT/HOLD measurement is
> live (so the page makes no HOLD claim).

- [1. Verdict](#1-verdict)
- [2. What the page is today](#2-what-the-page-is-today)
- [3. What the product actually is](#3-what-the-product-actually-is)
- [4. Claim audit: page vs code](#4-claim-audit-page-vs-code)
- [5. Other content problems](#5-other-content-problems)
- [6. Positioning and audience](#6-positioning-and-audience)
- [7. The plan: page architecture](#7-the-plan-page-architecture)
- [8. Copy deck](#8-copy-deck)
- [9. Proof plan](#9-proof-plan)
- [10. SEO and AI-search plan for the page itself](#10-seo-and-ai-search-plan-for-the-page-itself)
- [11. Work list](#11-work-list)
- [12. Decisions only you can make](#12-decisions-only-you-can-make)

---

## 1. Verdict

The page is well structured and well written. The story arc is right: problem,
how it works, five engines, proof, price, FAQ, CTA. The copy is short, plain
and specific.

The problem is that **it sells a product that is bigger than the one in the
repo, and it shows invented numbers next to a claim that nothing is invented.**

Three things matter more than everything else in this document:

1. **The Fix Engine claim is the headline, and it is only half true.** The page
   says a fix "goes live on Next.js, Shopify, WordPress or plain HTML" and shows
   "1-Click Shopify", "CMS Sync" and "Auto-Deploy". The only shipping path in
   code is a **GitHub pull request that is never merged** (§4, row 1). The CMS
   publisher (Design Studio) was deleted in #76.
2. **Every number on the page is hardcoded and none is measured.** The four
   "12,480+ pages crawled / 1,890+ fixes shipped" counters, the 78 / 52 / 96
   scores, the ₹24K and ₹45,000 values are string literals. The README says
   *"there is no demo or placeholder data"* and ships a build check to enforce it.
   The check does not cover these files (§5.1).
3. **There are three different price lists** and two different competitor limits
   across the landing page, `/pricing`, and the backend (§4, rows 9 to 11).

The good news: the real product is a stronger story than the one on the page.
The workflow now has a lifecycle, a proof ledger and a control group
(TREAT/HOLD) that no competitor in the comparison table has. The page never
mentions it. The plan below rebuilds the page around what is true, and moves the
strongest true claim to the top.

---

## 2. What the page is today

Order on `/` (`app/(marketing)/page.tsx`), about 2,700 lines of component code:

| # | Section | File | Job | Content quality | Evidence quality |
|---|---|---|---|---|---|
| 0 | Header | `landing-header.tsx` | Nav: Pricing, Login, Dashboard | Thin: no product links | n/a |
| 1 | Hero | `hero-section.tsx` | Promise + URL box + dashboard mockup | Strong headline, two `<h1>`s | Mockup numbers are invented |
| 2 | Proof strip | `proof-strip.tsx` | 6 customer names + 4 counters | Names OK, counters weak | **Counters are fabricated** |
| 3 | Problem | `trust-section.tsx` | Pain: reports not results, rivals, AI | Very good | Unsourced |
| 4 | How it works | `workflow-steps.tsx` | 4 steps + second dashboard mockup | Good | Mockup numbers invented |
| 5 | Five engines | `feature-cards.tsx` | Audit, Fix Engine, Competitors, AI, GBP | Good copy | 5 invented widgets |
| 6 | Technical buyer + 3 audiences | `value-section.tsx` | Crawler, schema, proof, multi-AI, security | Good | Third mockup, invented |
| 7 | Cost comparison + price cards | `cost-comparison.tsx` | ROI table, plan teasers | Persuasive | Competitor prices unsourced; plans disagree with `/pricing` |
| 8 | FAQ | `faq-section.tsx` | 7 questions | Good | Some answers overclaim |
| 9 | Final CTA | `final-cta.tsx` | URL box again | Good | n/a |
| 10 | Footer | `landing-footer.tsx` | Links, "All systems operational" | Many links point to unrelated pages | Status text is static |

What works and should be kept:

- Headline pair: "Find what's costing you customers. Fix it before your competitors do."
- The "Reports, not results" framing, and "Find it. Fix it. Prove it."
- One primary action (paste a URL) repeated three times.
- Plain-language plan and FAQ copy, ₹ pricing, INR/USD toggle.
- "Approve first, never changes your site without asking." This is true and is
  the best trust line on the page.

---

## 3. What the product actually is

This is the reference every claim on the page is checked against.

### 3.1 Workflow (from `docs/workflow/00-ARCHITECTURE.md` and the code)

```
1 CONNECT   site URL, Search Console, GA4, Business Profile, GitHub repo, rivals
2 DETECT    crawler + issue engine, competitor engine, AI-visibility checks,
            Search Console / GA4 opportunities, Places geo-grid
3 NORMALISE issues fingerprinted so a re-crawl updates instead of duplicating;
            grouped by issue type x site; one ranked queue
4 DECIDE    Fix it / Not now / Why?   (the only human step)
5 EXECUTE   routed by what the fix touches, not by which detector found it:
              AUTO      meta, alt text, schema, canonicals, sitemap  -> snapshot, apply
              APPROVAL  headings, links, redirects, robots           -> PR with diff
              MANUAL    thin content, 5xx, HTTPS, soft 404           -> draft, handed over
6 PROVE     re-crawl, verify, then measure lift at +7 / +30 days
            against a HOLD group (difference-in-differences)
```

Status of each stage in the code today (from `docs/strategy/implementation-plan.md`
and the task list in `docs/workflow/README.md`): stages 1, 2, 5 (PR path) and the
proof schema are built. The single ranked queue, the single lifecycle enum and
turning the HOLD arm on are **planned tasks 3, 4 and 6**. Check their state
before writing copy that leans on them (§12, decision 3).

### 3.2 Products a customer can actually use

| Surface | Route | Real capability |
|---|---|---|
| Website Audit | `/website` | Headless crawl (JS rendered), ~25 issue types, health score, PDF report |
| Autopilot | voice / `/analyze` | URL in, finds up to 5 rival suggestions, customer picks up to 3, crawls, writes a competitor report |
| Competitor Intelligence | `/competitor-intelligence` | Up to **5** rivals (`MAX_COMPETITORS = 5`), daily page snapshots (03:00), moves, gaps, counter-move drafts |
| AI Visibility | `/ai-visibility` | Asks ChatGPT, Claude, Gemini, Perplexity, Sarvam as a plain user question, daily (06:00). Stores the answer as evidence |
| Google (GSC + GA4) | `/google/*` | Rankings, index status, "why not ranking", changes, traffic origins, improvement report |
| Business Profile | `/google/business-profile` | Connect via Google, profile audit, reviews and reply drafts, photos, services, posts, categories |
| Local rankings | GBP tab | Real Places query per grid point, stored history. Charged in tokens (3x3 = 45,000) |
| Fix Engine | `/fix-engine` | Prepares low-risk fixes and opens a **GitHub PR**. Never merges |
| Reports | `/reports/*` | Client-ready printable reports |
| Tokens | `/tokens` | Workspace token balance, monthly allowance 5,000,000, per-feature cost |
| AIVA | voice panel | Voice layer over the same product. Not a separate product |

### 3.3 AI models and how they are used

One router, `MultiAiRouterService`, handles every model call (about 50 call
sites). Task routing, refusal fallback, JSON-validity fallback, budget and spend
ledger all apply.

| Routing profile | Used for | Preference order |
|---|---|---|
| REASONING | SEO analysis, competitor analysis, page comparison, opportunity generation, AI-visibility analysis | Mammouth, Anthropic, Gemini, OpenAI, Sarvam, Groq, OpenRouter |
| CODE_GEN | Code generation, code review, fix validation | Mammouth, Anthropic, OpenAI, Gemini, ... |
| FAST | Content structure, entities, local SEO, review replies, summaries | Mammouth, Sarvam, Groq, Gemini, OpenAI, Anthropic |

Model IDs configured in code include Claude Opus 5 / Sonnet 5 / Haiku 4.5,
GPT-4.1 / 5.4, Gemini 2.5 / 3.7 Flash, Sonar, Llama 3.1 (Groq), DeepSeek and
Sarvam. A separate, fixed list decides **which assistants get measured**:

| Assistant | Measured | How |
|---|---|---|
| ChatGPT, Claude, Gemini, Perplexity, Sarvam | Yes | Each is asked only through its own vendor API |
| Google AI Overviews, Copilot | **No** | No public API. Recorded as "could not ask", never as 0% |

Design rules that are the product's real integrity story: measured only through
the vendor's own API; absent data is `null` and an honest empty state; costs are
`null` when there is no published rate; the AI never guesses a metric.

### 3.4 Data models that matter to the story

| Model | Why it matters to a buyer |
|---|---|
| `Issue` with fingerprint | "It remembers": how long open, did it come back |
| `GrowthOpportunity` | The single ranked queue |
| `PromptCheck` | Every AI answer stored with citation, position, competitors named, engine and model |
| `FixIntervention` (TREAT / HOLD) + `InterventionOutcome` | Proof that a change caused a gain |
| `PageSnapshot`, `RollbackRecord`, `VerificationResult` | Undo and before/after proof |
| `GeoGridRun` / `GeoGridPoint` | Local rank **history**, not a screenshot |
| `TokenWallet` / `TokenTransaction` | Transparent usage, append-only ledger |
| `LocalLocation` (many per project) | Multi-location is now representable |

---

## 4. Claim audit: page vs code

Severity: **A** = a customer could feel misled or a claim is false today,
**B** = unverified or inconsistent, **C** = wording.

| # | Sev | Page says | Where | Code says | Action |
|---|---|---|---|---|---|
| 1 | A | Fix "goes live on Next.js, Shopify, WordPress or plain HTML"; "1-Click Shopify / GitHub"; "CMS Sync"; "Auto-Deploy"; FAQ "ships it to Shopify or WordPress" | feature-cards, hero, workflow, faq, pricing FAQ, footer | Only path is `AutomationRun` producing a **pull request**; UI says "Nothing is published until you review and merge it". `CMS_DRAFT` exists as an enum value only; no CMS code. Design Studio removed in #76 | Rewrite to "opens a pull request on your repo". List Shopify/WordPress/Webflow as "coming", or remove |
| 2 | A | "Fixes shipped 1,890+", "Pages crawled 12,480+", "Issues found 3,420+", "Competitors tracked 840+" | proof-strip | Hardcoded strings. No query | Replace with real counts from the DB, or remove |
| 3 | A | Hero mockup: Health 78, AI share 52% vs 31% rival, "+₹24K/mo", "PR #48"; feature widgets: Health 96/100, "Valued: ₹45,000/mo", geo-grid "Avg #1.2" | hero, feature-cards, workflow, value | All literals. `₹` value per fix is not a computed field | Label as "Example" or drive from a real sample audit (§9) |
| 4 | A | "Results in about 60 seconds" | hero, workflow, final-cta | Full crawl is depth 20, concurrency 10; autopilot waits up to 1 hour for rival crawls | Measure the p50 audit time and quote that, or say "minutes" |
| 5 | A | "Free audit... No card needed" but the box goes to `/login?url=` | hero | Requires an account first | Say "Free account, no card" |
| 6 | B | "Track competitor pages, pricing changes, and keyword gains **daily**" | feature-cards | Daily page snapshots yes (03:00). "Pricing changes" and "keyword gains" not confirmed as detectors | Keep "pages and content", verify the other two |
| 7 | B | "Every issue and gap gets a ₹ value" | workflow step 3 | Impact score exists (`impact-score.util`). A rupee value per issue not found in schema | Verify, else say "priority and effort" |
| 8 | B | "AI assistants in English and **Indian languages**" | feature-cards | Sarvam is measured. Multilingual prompt sets not confirmed | Verify before keeping |
| 9 | A | Landing plans: Starter ₹2,999 / **Growth ₹7,999** / **Agency ₹19,999** | cost-comparison | `/pricing`: Starter ₹2,999 / **Growth ₹4,999** / **Scale ₹7,999** | One price list (§12, decision 1) |
| 10 | A | Landing Starter: "**3** competitors"; step 1: "up to **5**" | cost-comparison, workflow | `/pricing`: Starter "up to 5", Growth "up to 20", Scale "unlimited". Code: hard cap **5** | Fix limits to what `MAX_COMPETITORS` allows, or raise the cap |
| 11 | A | `/pricing` "Unlimited Competitor Tracking", "20 websites", "Dedicated Account Manager", "Custom Integrations" | pricing | Cap is 5. No plan gating found in the modules read | Remove until built |
| 12 | B | Agency: "white-label PDF reports, bulk fix deployment" | cost-comparison, faq, value | `ClientPortalConfig` has logo + colour. "Fix all safe (n)" is planned task, not built. Moat doc says bulk ops must work at 200 locations first | Say "branded reports" if true; drop "bulk fixes" until built |
| 13 | B | "Weekly progress reports / executive briefs" | pricing, cost-comparison | Weekly scheduler exists (Mon 01:00). Not confirmed as an emailed brief | Verify |
| 14 | B | "Enterprise-grade encryption, isolated tenant workspaces, zero data sharing" | value, faq | Encryption key + tenant org model exist. "Enterprise-grade" and "never used to train" are contractual statements | Have someone own the wording; link a security page |
| 15 | B | "Routes each task to the best AI model" / "Multi-AI engine" | value | True (router). But it is a vendor list, not a customer benefit | Reframe as the benefit (§8) |
| 16 | C | "Competitors: Otterly, Peec, Profound, Local Falcon" with prices | cost-comparison | Third-party prices go stale and are attackable | Add "as of" date and source, or use ranges only |
| 17 | C | Save "96%" and "over ₹77,000/mo" | cost-comparison | Maths is `₹80,000+ vs ₹2,999`, but it assumes a customer buys **all five** line items | Say "if you replaced all five", show the assumption |
| 18 | C | "Which AI assistants do you track?" lists 4 | faq | Also Sarvam. AI Overviews and Copilot **cannot** be measured | Add both facts. It is a trust point |
| 19 | C | "A ₹ value on every fix... +₹39,700/mo potential" | hero fix tab | Same as row 3 | Same |

Section 4 has one rule underneath it: **the FAQ answer to "Will it change my
site without asking?" ("Never") is the only claim that is true, testable and
unique. Move it up.**

---

## 5. Other content problems

### 5.1 The page contradicts the repo's own guard

`scripts/check-no-fabricated-data.mjs` is the frontend's central promise check.
It scans for invented values, but its rules target `||`/`??` defaults, random
numbers and demo business names. Hardcoded stat strings in JSX pass. Whitelisted
today: `proof-strip.tsx` for "MilQuu Fresh".

Do this: add a rule that fails on any `components/marketing/*` numeric
literal outside a named `SAMPLE_*` constant, and require every sample widget to
carry an on-screen "Example" label. Then the page and the README say the same
thing.

### 5.2 Structural

| Problem | Evidence | Fix |
|---|---|---|
| Two `<h1>` in the hero | `hero-section.tsx` | One `<h1>`, second line as a `<span>` |
| Cold visitor CTAs send to `/dashboard` | trust-section, value-section, workflow | Send to the URL form or `/register`. Dashboard is for customers |
| Mockups repeat the same 3 numbers (78/68, 52, 12 of 38) across 3 sections and disagree (78 vs 68 health) | hero vs workflow | One sample audit, used everywhere |
| Three dashboard mockups plus five widgets is roughly 1,500 of 2,700 lines and no real screenshot | marketing dir | Replace with one real, redacted screenshot per engine |
| Handwritten "cursive" annotations, arrows | 4 places | Fine as brand. Ensure they never carry a claim |
| No section for the proof ledger, rollback, or "what we will not touch" | n/a | Add (§7, section 6) |
| Footer: ~40 links, most go to `/pricing` or `/help`. "Careers", "Affiliates", "Customers", "Blog & Research", "Launch Library", "Skills & Engine Docs" have no destination | footer | Cut to links that exist |
| Footer lists 9 industries (SaaS, Healthcare, Real Estate...) all to `/pricing` | footer | Remove. Three real audiences are on the page |
| "All systems operational" is static text | footer | Link to a real status source or remove |
| Footer outbound links open ChatGPT, Claude and Perplexity with a canned question | footer | Fine as GEO tactic, but note it hands traffic away. Keep only if intentional |
| Name collision: **AIVA Enterprises** (a customer in the logo strip) and **AIVA** (the voice agent) | proof-strip, voice | Pick one public name for the voice layer, or explain it |
| Logo strip is text only, no permission trail in repo | proof-strip | Get written OK per logo, add logos |

### 5.3 Metadata and discoverability

- `app/layout.tsx` says "The world's most advanced AI-powered SEO automation
  platform. Automate technical SEO, **generate optimized content**..." while
  `(marketing)/layout.tsx` says "Built for Indian brands and agencies". Two
  different pitches, and the first one promises content generation, which the
  strategy explicitly declared out of scope.
- `openGraph.locale` is `en_US`. The audience is India: `en_IN`.
- No `sitemap.ts`, `robots.ts`, `llms.txt` or JSON-LD in `app/`. For a product
  that sells SEO and AI visibility, this is the most embarrassing gap on the page.
- No OG image (`public/` holds only the default Next.js SVGs).
- Only one indexable marketing page (`/`) plus `/pricing`. Nothing to rank for
  any query except the brand.

---

## 6. Positioning and audience

Two documents in the repo disagree about who the page is for:

- The page speaks to a **business owner** ("Find what's costing you customers").
- `docs/strategy/moat-analysis.md` recommends **agencies as the primary ICP**,
  multi-location businesses second, with the reasoning that a solo founder
  cannot support a direct SMB sales motion. It also names the sharpest
  counter-position: Semrush and Ahrefs cannot ship auto-fix because agencies are
  their channel.

The page today gives agencies one card ("Run 20 clients like 2") halfway down and
one FAQ line. If the strategy stands, the page is aimed at the wrong reader.

Recommended message hierarchy, which works for both readers:

| Level | Message | Proof it is true |
|---|---|---|
| Promise | Find it. Fix it. Prove it. | Tagline exists |
| Differentiator | It changes your site only when you approve, and shows what it did | PR-only Fix Engine, snapshots, rollback |
| Unique claim | It measures whether a fix worked, against pages it left alone | TREAT/HOLD ledger (verify state, §12) |
| Breadth | Site, rivals, AI answers, Google, Maps in one queue | Modules in §3.2 |
| Fit | Agencies and multi-location Indian brands | Strategy doc |

What not to lead with: "AI-powered", "automation", "the world's most advanced".
Every competitor says it. The ledger and the approval rule are the only lines
nobody else can say.

---

## 7. The plan: page architecture

Target: same length, fewer components, every claim backed. Sections are ordered
by the question a visitor asks.

| # | Section | Visitor's question | Content | Proof | Primary CTA | Source of truth |
|---|---|---|---|---|---|---|
| 1 | Hero | What is this, is it for me? | H1 + one-line "what it does" + URL box + one real product screenshot | Real screenshot, labelled | Run free audit | Website Audit |
| 2 | Trust bar | Who else uses it? | Real logos with permission. Counters only if read from DB | Logos, live counts | none | DB counts |
| 3 | The problem | Do you understand my pain? | Keep the current section. Cut "Go to Dashboard" box, replace with the URL form | Cite one real stat per card | URL form | none |
| 4 | How it works | What happens after I paste? | 4 steps, corrected: paste, we crawl and compare, you get a ranked queue, you approve and we open a PR, we re-crawl and prove | Real 60s? No: real timing (§4 row 4) | Run free audit | Workflow 1 to 6 |
| 5 | **Proof ledger** (new) | How do I know it worked? | Before/after crawl, rollback, TREAT vs HOLD explained in one diagram | One real anonymised case (§9) | See a sample report | `FixIntervention`, `VerificationResult` |
| 6 | **Safety rules** (new) | Will it break my site? | Three classes: applies directly (meta, alt, schema), needs your review (headings, links), we draft, you decide. Snapshot first, undo. The 25-page cap and never-touch list are in the spec (arch. §5) but I did not find them enforced in code, so show them only once verified | The `FIX_CLASS` table | none | `fix-class.ts`, arch. §5 |
| 7 | Five engines | What exactly do I get? | Keep the five cards. Fix Engine card says PR. AI card names 5 measured, 2 not | One real widget each | Per-engine link | §3.2 |
| 8 | Who it's for | Is this me? | Agencies first, multi-location second, D2C third | Case per audience when available | Talk to us (agencies) | Strategy |
| 9 | Under the hood | Can I trust the data? | Headless crawler, schema parsing, "measured through each vendor's own API", "if we can't measure it, we say so" | Vendor list from `ASSISTANT_PROVIDER` | none | §3.3 |
| 10 | Pricing | What does it cost? | One price list, INR first. Replace comparison table with a shorter, dated one | Dated, sourced competitor prices | Choose plan | One config |
| 11 | FAQ | Objections | 10 questions (§8.6). Add `FAQPage` JSON-LD | n/a | none | Code |
| 12 | Final CTA | Ready? | URL form again | none | Run free audit | n/a |

Rules for the build:

1. Every number is either from an API call, or inside a component named
   `Example*` with a visible "Example" tag. No third category.
2. One price config file, imported by `/`, `/pricing` and (later) checkout.
3. One sample dataset, used by hero, steps and widgets, so numbers agree.
4. Every CTA on `/` leads to the URL form, `/register` or `/pricing`. None to
   `/dashboard`.

---

## 8. Copy deck

Drafts, ready to edit. Bracketed items need a fact confirmed first.

### 8.1 Hero

- Eyebrow: `SEO, AI SEARCH AND GOOGLE MAPS, ONE QUEUE`
- H1: **Find what's costing you customers. Fix it before your competitors do.** (keep)
- Sub: `GrowthX crawls your site, watches your rivals and asks ChatGPT, Claude, Gemini, Perplexity and Sarvam about you. It ranks what to fix, opens the pull request, and checks the fix worked.`
- Form: `yourwebsite.com` / **Run free audit**
- Micro: `Free account · No card · Audit ready in [measured time]`

### 8.2 Problem (keep, with one sharper bridge)

Bridge line: `Most tools stop at the report. GrowthX starts there.`

### 8.3 How it works

1. **Paste your site.** Add up to 5 rivals, or let us suggest them.
2. **We crawl and compare.** Every page, rendered like Google sees it, plus rival pages and AI answers.
3. **You get one ranked list.** Each item shows the evidence, effort and priority.
4. **Approve, and we open the pull request.** Nothing goes live until you merge it.
5. **We check it worked.** A re-crawl confirms the fix, then we measure the result over 30 days.

### 8.4 Proof ledger (new section, the differentiator)

- Kicker: `PROVE IT`
- H2: **Most tools tell you a number went up. We tell you why.**
- Body: `Every change we make is snapshotted, re-crawled and timestamped. Where we can, we leave a matching set of pages untouched, so a rise in AI citations can be compared against pages that did not change. You get evidence, not a coincidence.`
- Three bullets: `Before/after crawl on every fix` · `Undo for a year` [`RollbackRecord` exists; confirm the retention] · `Compared against pages we left alone [only if HOLD is live]`
- CTA: `See a sample report`

### 8.5 Safety rules (new section)

- H2: **It changes your site only when you say so.**
- Three cards, taken from `fix-class.ts`:
  - **Applies after one click.** Titles, descriptions, alt text, schema, canonicals, sitemap. Invisible to visitors, snapshotted first. [only if AUTO is enabled for customers]
  - **You review the change.** Headings, links, redirects, robots. Shown as a before/after diff in a pull request. We never merge.
  - **We draft, you decide.** New pages, thin content, server errors, review replies.
- Footer line: `Never touches pricing, contact details or legal pages by default.` [confirm never-touch list is on]

### 8.6 FAQ (10)

Keep: Do I need a developer? · Will it change my site without asking? · How is
this different from Semrush or Ahrefs? · How long until I see results? · Can
agencies use it? · Is my data safe?

Rewrite:

- **Which AI assistants do you track?** `ChatGPT, Claude, Gemini, Perplexity and Sarvam, each asked through its own official API. Google AI Overviews and Copilot have no public API, so we tell you we could not ask rather than show a zero.`
- **Where do fixes go live?** `We open a pull request on your GitHub repository. You review and merge it. [Shopify and WordPress: coming. Until then you can copy the snippet.]`

Add:

- **Does it work on JavaScript sites?** `Yes. The crawler renders pages the way Googlebot does, so React and Next.js sites are audited correctly.`
- **What does a free audit include?** `[List exactly: crawl size limit, issues shown, whether rivals and AI checks are included.]`
- **What happens to my token balance?** One line pointing to `/tokens`. Transparency is a differentiator.

### 8.7 Pricing headline

Replace `An SEO team and four tools, from ₹2,999/month` (it implies parity with
an agency). Use: **One price. Audit, rivals, AI answers and Maps, from ₹2,999 a month.** Show the comparison as
"What you would otherwise pay" with a date, and a footnote stating the
assumption that all five lines are needed.

---

## 9. Proof plan

The page is only as credible as its proof. What can be built from what already
exists:

| Proof asset | Source | Effort | Replaces |
|---|---|---|---|
| **Live counters** (sites audited, issues found, pages crawled, fixes verified) | `SELECT count(*)` on `Website`, `Issue`, `Page`, `VerificationResult`, via one cached public endpoint | 1 day | The 4 fabricated counters. Show only counts you are happy to publish, and hide any below a floor |
| **One public sample audit** | Run the product on GrowthX's own site, publish the real report at `/sample` | 1 day | All invented mockup numbers |
| **Real screenshots**, redacted | The five product screens | 1 day | Three mockups and five widgets |
| **One case study** | An existing customer with a re-crawl before/after and a `VerificationResult` | 3 days | The invented "+₹24K/mo" |
| **Ledger example** | Any `FixIntervention` with a HOLD pair, once task 6 lands | Blocked on task 6 | Nothing today, adds the moat |
| **Logo permissions** | Six brands in the strip | Founder | Text-only strip |

Do not publish an outcome number (traffic, revenue, citation lift) unless it
comes from a `VerificationResult` or `InterventionOutcome`. The strategy doc
already warns that a raw before/after is not causal proof. The ledger returns
`lift: null` when there is no control, and the page should behave the same way.

---

## 10. SEO and AI-search plan for the page itself

A product that sells this should pass its own audit.

| Item | Do |
|---|---|
| Title / description | One pitch across `layout.tsx` and `(marketing)/layout.tsx`. Title 50 to 60 chars, description 150 to 160, lead with the outcome, drop "world's most advanced" |
| `openGraph.locale` | `en_IN` |
| OG and Twitter image | Add a 1200x630 image from the real sample audit |
| `app/sitemap.ts`, `app/robots.ts` | Add. List `/`, `/pricing`, legal pages, new content pages |
| `public/llms.txt` | Add. The footer already links an "LLMs.txt Generator", so the site should have one |
| JSON-LD | `Organization`, `SoftwareApplication` (with `offers` from the price config), `FAQPage` on the FAQ |
| Canonical | Explicit canonical on `/` and `/pricing` |
| Headings | One `<h1>`. `<h2>` per section as in §7 |
| Internal links | Each engine card links to its own landing page, not `/website` or `/ai-visibility` (those are app routes behind login) |
| Supporting pages | The single biggest SEO lever. Suggested first five, each backed by real product output: `/ai-visibility-tracker` · `/competitor-monitoring` · `/google-business-profile-audit` · `/technical-seo-audit` · `/for-agencies` |
| Measure it | Point GrowthX's own Search Console and AI-visibility tracking at growthx.in and publish the trend. It is the best case study you can have |

---

## 11. Work list

**P0. Stop the false claims (about 2 days, no design work)**

1. Fix Engine copy: PR only, in hero tab, feature card, workflow step 4, FAQ, pricing FAQ. Remove "1-Click Shopify", "CMS Sync", "Auto-Deploy".
2. Remove or relabel the four counters. Label every mockup "Example".
3. Reconcile prices and limits into one `lib/pricing.ts`, used by `/`, `/pricing`, metadata.
4. Change "Results in about 60 seconds" to a measured figure.
5. "Free audit, no card" becomes "Free account, no card".
6. Replace `/dashboard` CTAs on the cold page.
7. Delete unsupported plan lines on `/pricing` (unlimited competitors, account manager, custom integrations) unless built.

**P1. Fix the foundation (about 1 week)**

8. One `<h1>`; one metadata pitch; `en_IN`; OG image.
9. `sitemap.ts`, `robots.ts`, `llms.txt`, JSON-LD (Organization, SoftwareApplication, FAQPage).
10. Marketing rule added to `check-no-fabricated-data.mjs` (§5.1).
11. Live counters endpoint; real logos with permission.
12. Trim the footer to real links; drop static "All systems operational".
13. Replace the three mockups with one sample dataset and real screenshots.

**P2. Build the differentiator (2 to 4 weeks)**

14. New sections: Proof ledger and Safety rules (§8.4, §8.5).
15. Public `/sample` audit and one case study.
16. Agencies-first page section and `/for-agencies`.
17. Five supporting SEO pages (§10).

**P3. After product work lands**

18. Turn on TREAT/HOLD (task 6), then show a real ledger example.
19. Add Shopify/WordPress copy only when a publisher exists.
20. Add "Fix all safe (n)" and bulk claims only after the queue tasks ship.

---

## 12. Decisions only you can make

1. **Which price list is real?** Landing (Starter ₹2,999 / Growth ₹7,999 /
   Agency ₹19,999) or `/pricing` (₹2,999 / ₹4,999 / ₹7,999). The moat analysis
   prices around per-location. I recommend the landing set, since `/pricing`
   promises "unlimited" things the code caps.
2. **Who is the primary reader: agencies or business owners?** The strategy says
   agencies. The page says owners. The plan in §7 leads with both but weights
   agencies. Confirm before the copy is rewritten.
3. **Are tasks 3 (unified queue), 4 (lifecycle) and 6 (HOLD arm) merged?** I found
   the schema for interventions, `fix-class.ts` and issue grouping, but I did not
   verify that HOLD assignment runs in production. The proof-ledger section
   depends on this. If it is not live, ship the section without the HOLD line.
4. **Do you want CMS publishing (Shopify, WordPress)?** It was removed in #76.
   If it is on the roadmap, say "coming". If not, delete every mention.
5. **May the six customer names stay?** The build check already allows
   "MilQuu Fresh", but there is no record of permission for the rest.
6. **Do we publish live counters?** They are honest only if you are comfortable
   showing small numbers. If not, cut the strip to logos.
7. **Is the free audit limited?** The page does not say what the free tier
   covers. Decide crawl size and which engines are included, then say so.

---

## Appendix: files read

Landing: `growthx-ai-seo/src/app/(marketing)/{page,layout}.tsx`,
`pricing/page.tsx`, `app/layout.tsx`, `components/marketing/*.tsx` (all 11).
Product: `growthx-ai-crawler/prisma/schema.prisma`,
`src/modules/{ai-search/multi-ai-router,ai-visibility,issues,autopilot,impact,competitor-action-engine,local-seo,rival-snapshots,tokens,voice-agent}`,
`components/fix-engine/ship-panel.tsx`, `components/gbp/gbp-tabs.tsx`.
Docs: `README.md`, `docs/workflow/*`, `docs/strategy/*`, `docs/tokens.md`,
`growthx-ai-crawler/src/modules/ai-visibility/README.md`,
`growthx-ai-seo/scripts/check-no-fabricated-data.mjs`.
