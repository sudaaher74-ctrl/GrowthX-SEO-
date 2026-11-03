# Crawl evidence integrity release

Deploy the API and crawler worker from the same commit, then deploy the frontend. No database migration is required. Do not overwrite historical crawl records or mark old findings resolved solely because detection rules changed.

After deployment, run a new audit and compare the same URLs across the previous and current crawl:

- A loading-only rendered page must produce an unavailable assessment, not missing-title, H1, thin-content or duplicate-content claims.
- Conflicting canonical targets must be reported with both URLs and unknown indexability, unless an explicit status/robots restriction is observed.
- Account, cart, checkout, login and wallet routes must not receive thin-copy or sitemap-inclusion recommendations.
- Product review/rating markup is optional and must not generate a task to invent ratings.
- Impact proof must use the verified URL and its own baseline, never the first changed URL of a multi-page pull request.
- Repeated verified outcomes are grouped with attempt IDs retained in activity history.

The MilQuuFresh live canonical tags and empty cart product-image alt text require changes to that website's repository. Detection/reporting changes in this release do not modify customer websites. A new score is not evidence of increased traffic or AI visibility.
