# Laptop integration recovery

Deploy the API and worker from the same committed release before promoting a frontend that depends on new routes. Run `node scripts/check-api-contract.cjs https://api.reigel.in` to catch missing Google, AI Visibility and backlink recommendation endpoints. This check is unauthenticated and makes no paid AI calls.

On the existing Ubuntu Docker host, run `sudo bash scripts/install-google-catchup.sh`. The installer stores a copy of `google-catchup-sync.cjs` under `/usr/local/lib/growthx-server` and enables a systemd timer. It checks 45 seconds after Linux boots and every fifteen minutes thereafter. Only configured Search Console and Analytics connections with a selected resource and data older than 24 hours are synced. An hourly per-connection retry limit and Redis lock avoid overlapping catch-up attempts. Tokens, credentials and customer data remain outside Git.

Inspect `systemctl list-timers growthx-google-catchup.timer` and `journalctl -u growthx-google-catchup.service`. The helper is copied into the current API container for each invocation, so container replacement does not remove the scheduled sync. Google connections marked NEEDS_SELECTION or NEEDS_REAUTH require the customer's property selection or renewed authorization; the timer cannot resolve them. Business Profile API approval is also controlled by Google.

After deployment, verify Search Console and Analytics pages using the existing connection and inspect the AI Visibility journey queue before retrying any saved run. Preserve saved questions and answers. Do not automatically launch paid AI scans on laptop startup or silently switch measurement providers when one is unavailable.
