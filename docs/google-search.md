# The Google Search page

Where a customer's pages rank in Google, why a page does or does not rank, what
Google has indexed, and what happened to search results after a change. It runs
on the customer's **own Search Console and Google Analytics 4**. Neither costs
the platform anything, and nothing on the page is estimated when they are not
connected: it asks for the connection instead.

## What each tab needs

| Tab | Reads | Needs |
| --- | --- | --- |
| Rankings | Every search Google showed the site for, with its average position, the move since the period before, clicks, times shown, click-through rate and the page shown. With GA4, the visits that page received. | Search Console (GA4 optional) |
| Why not ranking | How Google has been showing one page for one search over the last 28 days and the 28 before, plus the page itself read live and Google's index status for it. With GA4, the visits and conversions on the page. | Search Console (GA4 optional) |
| Index status | Google's own answer, from URL Inspection, for each page. | Search Console |
| Change results | Clicks, times shown and position before and after a recorded change. | Search Console (GA4 optional) |
| Risk check | What depends on a page today, before a delete, redirect or move. Uses the site crawl; Search Console and GA4 add search and visit figures when connected. | The site crawl |
| Competitor keywords | The keywords a competitor ranks for that the site does not. | A paid live-results source (below) |

The header shows which of Search Console and Google Analytics 4 are connected.
With neither, every tab that needs them shows one prompt pointing at
**Integrations**; it never mentions anything an operator sets up.

## Connecting

Each customer connects from **Integrations**: authorise, then choose the website
(Search Console) and the property (Analytics). The first fetch reads the last 90
days; after that a sync at 04:00 UTC each day keeps it current. On the Rankings
tab, **Fetch now** does the first fetch by hand. Because the first fetch holds
90 days, a 28-day comparison works at once, while a 90-day one has nothing
earlier to compare with until more history has built up.

Connecting only works if the API has Google credentials. On Render that is
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (which must
also be registered as an authorised redirect URI on the OAuth client),
`APP_BASE_URL` and `INTEGRATION_TOKEN_KEY`. If a credential is missing,
clicking **Connect** on Integrations (or **Fetch now**) says which. The Search
Console and Analytics APIs must also be enabled on the Google Cloud project;
Google's refusal is passed on with the API's name.

## What the numbers mean

- **Position is an average.** Search Console reports the average place a page
  held across every time it was shown in the period. It is not a reading taken
  now, and a page can hold different places for different people and countries.
  Averages are weighted by how often a search was shown, so a search shown three
  times cannot drag a page's position down.
- **A move is shown only when it can be trusted.** A search needs at least 20
  showings in both periods, and must move by a full place, to count as having
  moved. With no earlier period stored there is no move at all, never a
  comparison against zero.
- **Rankings compare the last 7, 28 or 90 days** (the control in the top bar)
  with the same number of days before them. A diagnosis always uses 28.
- **Visits are all visits.** GA4's landing-page figures are not split by source
  here, so "Page visits" counts every visit that started on the page, not only
  visits from Google. Conversions are left blank, not zero, when the property
  has no key events set up.

## Why not ranking, without Google's results page

From Search Console alone a diagnosis can say how Google has been showing the
page, whether it slipped against the 28 days before, whether people who see it
rarely click, whether Google shows a different page of the site for the same
search, whether the page is indexed, and what is wrong with the page itself
(a noindex tag, another canonical, a title or heading that lacks the words
searched for, few internal links). It cannot say what the pages above it do
differently, because it never saw them, and it says so. Its confidence is never
higher than medium for that reason.

## Live results (optional, paid)

If the platform has a DataForSEO account (`DATAFORSEO_LOGIN` and
`DATAFORSEO_PASSWORD`), the page gains what Search Console cannot know:

- a diagnosis that reads Google's results page and compares the customer's page
  with the ones that outrank it;
- keywords tracked live, with where each named competitor stands and who
  overtook whom between checks;
- the **Competitor keywords** tab;
- a "Google results for" market selector.

Each live check is a paid request, so a live diagnosis waits for the click
instead of running when a search is picked from the Rankings table, and every
project has a daily ceiling (`SERP_DAILY_CHECKS_PER_PROJECT`). Without the
account none of this appears; it is not shown as broken.

To see what a project is running on, `GET /api/projects/:id/search-intelligence/status`
returns `searchConsoleConnected`, `analyticsConnected` and
`googleResultsConnected` (the live-results source).
