# GitHub fix quality

Selected findings use `/automation/runs/plan-fixes`. The backend loads the selected findings within the project and gives the engineer their page scope. Custom requests use `/automation/runs/engineer` and preserve the full instruction. Do not replace either request with a predetermined create/finish sequence.

The engineer must read files before editing them, update existing website code, finish within its limits, and pass changed-file validation before pushing. Known audit-message placeholder paths and constants are rejected. A new helper without an existing-code edit is conservatively rejected; this is an integration check, not a proof that the implementation solves the finding. Preview review remains necessary. Validation output is recorded verbatim rather than described as a successful full build.

The live verification endpoint checks supported metadata fields against a saved crawl newer than the completed run. Generic source edits, missing expected values, stale crawls, and runs with multiple changes return `NOT_CHECKED`. They require specific page checks instead of inferred success. A merged PR alone does not increment the verified KPI. Explicit owner confirmation remains a manual assertion, separate from automatic live verification.

Old placeholder-only runs remain in history with a re-run warning. This release does not rewrite prior manual confirmations, close customer PRs, or merge them. Re-audit affected sites and review old PRs before publishing.

## Validation

Frontend: `node --test scripts/test-github-fix-requests.cjs`, `npm run typecheck`, `npm run build`.

Backend: generate the Prisma client for this commit, run `npm run build`, and run the engineer-agent, engineer-sandbox and proof-of-impact Jest suites.

Deploy matching frontend and backend versions using the existing release procedure. Verify that selecting a finding calls the plan endpoint, custom multiline instructions remain intact, and an old placeholder-only PR is shown as requiring a re-run. Create the next customer PR only after this rollout, inspect its actual page diff and preview, then deploy and verify affected URLs.

For the existing laptop watchdog, set `COMPOSE_FILE` in its private `.env.laptop` to the active release's absolute `runtime/compose.json` path after health verification. Compose reads this selector from `--env-file`, so the watchdog and startup commands use the saved release instead of rebuilding the older checkout. Keep the value outside Git and retain the previous release config for rollback. Allow at least two minutes for API initialization after containers start before deciding that a release is unhealthy; container recreation also includes the configured graceful shutdown period.
