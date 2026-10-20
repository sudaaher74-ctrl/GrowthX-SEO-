#!/usr/bin/env bash
set -euo pipefail
cd /mnt/c/Users/siddh/OneDrive/Desktop/growthXserver/portable-ai-visibility
sha=a7ece2726c8930d835fb37aa4f36653c45859d83
release=/home/growthx/releases/a7ece27-catalog-repair
python3 scripts/build-code-release.py ../visibility-catalog-final-release-20261020 .
python3 scripts/deploy-compose-release.py prepare . /home/growthx/GrowthX-SEO /home/growthx/GrowthX-SEO/.env.laptop "$release" "$sha"
python3 ../backend-model-repair/scripts/stage-analysis-budget.py stage "$release"
git diff --quiet 43849af161574538df70a2486f9f29a45dcebf4f "$sha" -- growthx-ai-crawler/prisma
python3 - <<'PY'
from pathlib import Path
import json,os,time
old=Path('/home/growthx/releases/43849af-model-repair/runtime')
new=Path('/home/growthx/releases/a7ece27-catalog-repair/runtime')
dump=old/'database.dump'; verified=old/'backup-verified'
assert int(verified.read_text())==dump.stat().st_size
assert time.time()-verified.stat().st_mtime<3600
assert json.loads((old/'compose.json').read_text())['name']==json.loads((new/'compose.json').read_text())['name']
os.link(dump,new/'database.dump')
(new/'backup-verified').write_text(verified.read_text())
(new/'backup-source').write_text(str(old))
print('Fresh verified backup retained; unchanged database schema.')
PY
python3 scripts/deploy-compose-release.py migrate . /home/growthx/GrowthX-SEO /home/growthx/GrowthX-SEO/.env.laptop "$release" "$sha"
