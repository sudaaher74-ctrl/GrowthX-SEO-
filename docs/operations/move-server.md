# Move GrowthX to another server

GitHub is the source for application code and non-secret configuration. The laptop runs the containers; edits to code or compiled files on that laptop must be committed to this repository before deployment. Build the API and worker from the same Git commit.

## Preserve before turning off the old server

1. Record the deployed Git commit and export a PostgreSQL backup. Keep the backup encrypted and test that it can be read. Back up the `crawler_snapshots` Compose volume, which is mounted at `/app/storage/snapshots`, if saved pages still reference it. Drain pending crawl jobs before shutdown or preserve the `redis_data` volume so queued work is not lost.
2. Securely transfer the private settings from the old environment file or secret manager. In particular, retain `POSTGRES_PASSWORD`, `ENCRYPTION_KEY`, `JWT_SECRET`, `GEMINI_API_KEY`, Google OAuth credentials, and any other configured provider keys. The original `ENCRYPTION_KEY` is needed to read existing Google connections. Never commit the environment file or backup.
3. Record how `api.reigel.in` reaches the old host (Cloudflare tunnel, DNS, or reverse proxy) and retain access to its credentials. Keep the hostname when moving hosts so the dashboard and OAuth callback URLs remain valid.

## Bring up the replacement

1. Install Docker and Compose. Clone this repository from GitHub at the commit chosen for deployment. Copy `.env.example` to `.env` on the new host and fill the private values there; use `GEMINI_MODEL=gemini-3.1-flash-lite` unless a newer tested model is selected. The model is passed to both API and worker by `docker-compose.yml`.
2. Start only PostgreSQL and Redis with `docker compose --env-file .env up -d postgres redis`. Restore the PostgreSQL backup into the new database. Restore the `crawler_snapshots` volume, and restore `redis_data` if queued work was preserved. Do this before starting the API or worker.
3. Run `docker compose --env-file .env up -d --build`. Check `http://localhost:3000/health`, the worker, database, and Redis. Verify an authenticated AI Visibility report using existing saved data before starting a paid scan.
4. Point `api.reigel.in` to the replacement host, then check `https://api.reigel.in/health` and the dashboard. If the public API hostname changes instead, update the dashboard's `NEXT_PUBLIC_API_URL` and redeploy it, and update the Google OAuth callback URLs and allowed origins.

The server move still requires the database, secrets, snapshot storage, any pending queue state, and public routing to move. Those are private runtime state, so Git cannot replace them. Application code and model configuration do not require re-editing on the new device.

## Future changes

For an existing Linux Compose host, `scripts/deploy-compose-release.py` builds a clean Git archive and retains the running API/worker environment, resource limits, network, volumes and previous image IDs. It requires Python 3.12+, Git and Docker Compose. Invoke it with `PHASE SOURCE_CHECKOUT LIVE_CHECKOUT ENV_FILE NEW_RELEASE_DIRECTORY FULL_COMMIT_SHA`. Run phases `prepare`, `build`, `backup`, `migrate`, then `activate` in order. Inspect pending migrations before `migrate`. The backup phase checks the PostgreSQL archive and snapshots Redis; no existing data volumes are replaced. Pause any external watchdog while activating and resume it after health checks. Deploy the matching frontend only after the API is healthy. `rollback` restores the previous API/worker images without dropping additive tables.

The release directory contains private resolved Compose settings and a database backup under `runtime/`; keep it outside Git, restrict access and encrypt it for off-host storage. Restart that release using `docker compose -p EXISTING_PROJECT -f RELEASE/runtime/compose.json up -d --no-build --no-deps api worker`. Point host startup automation at this saved release configuration; do not rebuild a historical dirty checkout. A new server uses the clean repository instructions above and restored private state.

Change code in a branch from current GitHub `main`; run relevant tests; open and merge a pull request; build and deploy that commit. Verify the live behavior and keep the previous image or commit available for rollback. If an emergency server edit is necessary, put the same fix in GitHub immediately so the next replacement server includes it.
