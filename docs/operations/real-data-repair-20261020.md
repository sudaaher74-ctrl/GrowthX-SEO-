# Real-data navigation and model repair — 20 October 2026

Frontend production main: `0c0dca73ffea95061acdd6cd33d8480879004f5e`.
Backend release: `43849af161574538df70a2486f9f29a45dcebf4f`, based on the
previous production backend `ac9134732d138c1d82c6ceaa165e0416ea6ee560`.

The frontend restores Google and the `/competitor-intelligence` website audit
workspace. Citation, competitor, and root-cause panels consume saved records;
missing measurements render explicit empty states. Failed requests never fall
back to demo figures. Unchecked questions are excluded from missed-opportunity
counts, and generic generated business claims were removed from patch previews.

The backend explicitly selects the verified `gemini-3.5-flash-lite` identity for
routine work, preserving customer attribution and existing spending controls.
Gemini 2.5 Flash remains available for competitor analysis and monitoring.
Provider prompt-generation failures return a descriptive HTTP 503.

Validation: frontend production build, fabricated-data guard, design guard, six
focused browser checks, 16 backend routing/budget checks, backend build, and live
Google JSON/schema/thinking-configuration probes passed. The Windows standalone
trace-copy warning is pre-existing and does not prevent Vercel's production
build. No schema/dependency change was required; Prisma confirmed no pending
migrations. The verified PostgreSQL backup is 2,225,284,515 bytes and resides
outside Git in `/home/growthx/releases/43849af-model-repair/runtime`.

Release activation is recorded in `scripts/activate-model-repair-20261020.sh`.
It uses the previously committed release helper, checks the exact health commit,
keeps the watchdog from racing activation, and rolls back on health failure.
Private runtime configuration, secrets, database contents, and backups stay
outside Git. Frontend and backend production activation were explicitly approved
by the owner in this session.
