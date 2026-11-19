# Review storage without deleting customer history

Performance records, audit history, rankings and traffic are application data.
Do not apply age-based deletion to PostgreSQL data, Redis queues, crawl snapshots
or saved report files as part of deployment housekeeping.

## Deployment database copies

`python3 scripts/cleanup-release-backups.py` prints a read-only plan. Add
`--apply` to execute that plan after the script checks retained archives.

The script preserves the newest two release backups with size-matched
`backup-verified` markers and any backup from the API/worker's active Compose
configuration directories. Copies less than 24 hours old are also preserved.
Both retained archives must pass `pg_restore --list` before deletion. This
checks the archive header/table of contents, not a full recovery drill.

Only eligible `releases/*/runtime/database.dump` files and their verification
markers are removed. The separate `backups` archive directory, current database,
Compose settings, rollback files, source trees, Docker images and volumes are
preserved. Unmarked/partial backups are reported by a separate inventory and
must be reviewed explicitly; this script does not remove them.

Run this only when no deployment or database backup is in progress. It checks
that API/worker Compose source locations and candidate file identities have not
changed. Symlinks are excluded, and changed files stop cleanup.

This is a manual policy, not a scheduled job. Free space is recovered inside
Ubuntu; its Windows VHDX file may retain its physical size until separate disk
compaction. Do not delete or move VHDX files manually.

## Cache and images

Build-cache cleanup can preserve application data, but shared layers may remain
referenced by tagged images. Review `docker system df`, `docker buildx ls` and
`docker buildx du` rather than assuming all displayed cache is physically
reclaimable. Review any image or test-environment removal against active and
rollback images and volume references first.
