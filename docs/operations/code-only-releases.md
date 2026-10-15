# Code-only server releases

Use the full Docker release for runtime, dependency, browser, or Prisma schema changes.
For code-only changes, `node scripts/build-code-release.mjs BASE_COMMIT OUTPUT_DIRECTORY`
compiles the clean committed source and records hashes for the complete backend artifact.
Artifacts stay outside Git. `python3 scripts/build-code-release.py ARTIFACT_DIRECTORY REPOSITORY`
checks the artifact, source tree, unchanged dependencies/schema, committed image recipe,
and the pinned base image revision before building the release image.

Deploy that image using the existing Compose release prepare, backup, migrate, activate,
health-check and rollback steps. Do not activate two releases concurrently. The Git commit,
compiled artifact manifest, source checkout, private configuration and verified database
backup remain available for review and recovery.
