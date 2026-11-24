# Redis Snapshot (`dump.rdb`) Git History Remediation Runbook

## Summary

The security review of revision `da55e4a0` identified three historical commits that added `dump.rdb` snapshots containing Redis RDB headers and BullMQ queue markers:

- `7b1fb32c`
- `e10a1b92`
- `9dd7b4ca`

Current `HEAD` does not track `dump.rdb`, `.gitignore` blocks `*.rdb`, `dump.rdb`, `*.aof`, `*.dump`, and `*.sql.gz` / `*.sql.zst`, and `node scripts/check-no-runtime-dumps.mjs` enforces that no runtime snapshots enter the tracked tree.

> **Status: Open for Operator Action**
> Automated source fixes do **not** rewrite Git history or revoke live credentials. Anyone with read access to repository history can still retrieve those historical blobs until operators complete the steps below.

---

## Step 1: Private Offline Inventory

Perform inspection in an isolated, non-shared directory outside any synced folder or chat/issue tracker. Never paste snapshot contents into tickets, logs, or commits.

```bash
# Export each historical blob to a private temporary directory with restricted permissions
TMP_AUDIT=$(mktemp -d)
chmod 700 "$TMP_AUDIT"
for sha in 7b1fb32c e10a1b92 9dd7b4ca; do
  git show "${sha}:dump.rdb" > "${TMP_AUDIT}/${sha}.rdb" 2>/dev/null || \
  git ls-tree -r --name-only "$sha" | grep -i '\.rdb$'
done

# Inspect keys and job payloads locally (e.g., via an isolated, network-disabled Redis container
# or offline RDB parser) to classify:
#   - customer domains, crawl URLs, or page content
#   - queued automation jobs (GitHub repo URLs, tokens, CMS credentials, webhook secrets)
#   - auth/session tokens or email addresses
```

Securely delete `$TMP_AUDIT` (`rm -rf "$TMP_AUDIT"`) immediately after recording high-level classification counts (not raw values).

---

## Step 2: Credential Rotation Checklist

Before or immediately upon history cleanup, rotate any credential class that was live during or could have appeared in BullMQ job payloads:

1. **GitHub tokens & GitHub App client secrets** (`SiteRepository.accessToken`, `GITHUB_CLIENT_SECRET`, GitHub App private keys).
2. **CMS credentials** (WordPress application passwords, Shopify Admin API tokens, Webflow API tokens).
3. **Google OAuth client secret & refresh tokens** (if queued sync payloads referenced them).
4. **Website crawl webhook secrets** (`Website.webhookSecret`) and outbound webhook signing secrets (`WebhookEndpoint.secret`).
5. **Redis password** (`REDIS_PASSWORD` / `REDIS_URL`) and application signing/encryption keys if any sensitive payload was exposed.

---

## Step 3: Coordinated Git History Rewrite

Coordinate a brief push freeze with all contributors, take a mirror backup offline, then rewrite history with `git-filter-repo`:

```bash
# 1. Clone a fresh mirror
git clone --mirror <REPO_URL> growthx-mirror.git
cd growthx-mirror.git

# 2. Remove all historical dump.rdb / *.rdb blobs from every ref
git filter-repo --path-glob '*.rdb' --invert-paths

# 3. Verify none of the historical blobs remain
git log --all --stat -- '*.rdb'

# 4. Force-push rewritten refs and tags (requires temporary branch-protection override)
git push --force --all
git push --force --tags
```

After force-pushing:
- Ask your Git hosting provider (e.g., GitHub Support) to purge cached views/PR objects referencing the old commit SHAs.
- Instruct all contributors and CI/deployment checkouts to re-clone fresh rather than rebasing old clones.

---

## Step 4: Preventive Controls

- Keep `*.rdb`, `dump.rdb`, `*.aof`, and database dump patterns in `.gitignore`.
- Run `node scripts/check-no-runtime-dumps.mjs` in CI and pre-commit hooks.
- Enable repository **Secret Scanning** and **Push Protection** (and block binary files > 5 MB or `*.rdb` via server-side pre-receive / branch rulesets).
- Configure Redis containers (`docker-compose.yml`) to persist only inside named Docker volumes (`redis_data:/data`), never bind-mounted into the Git checkout.
