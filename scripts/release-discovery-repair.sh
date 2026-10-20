#!/usr/bin/env bash
set -euo pipefail
mode=$1
sha=$2
artifact=${3:-}
[[ "$sha" =~ ^[a-f0-9]{40}$ ]]
cd /mnt/c/Users/siddh/OneDrive/Desktop/growthXserver/portable-ai-visibility
release="/home/growthx/releases/${sha:0:8}-discovery-repair"
phase() { python3 scripts/deploy-compose-release.py "$1" . /home/growthx/GrowthX-SEO /home/growthx/GrowthX-SEO/.env.laptop "$release" "$sha"; }
if [[ "$mode" == stage ]]; then
 python3 scripts/build-code-release.py "$artifact" .
 phase prepare
 # This release changes code only. Retain the verified database archive;
 # rollback switches images and does not restore or modify the database.
 git diff --quiet a7ece2726c8930d835fb37aa4f36653c45859d83 "$sha" -- growthx-ai-crawler/prisma
 python3 - "$release" <<'PY'
from pathlib import Path
import json,os,sys
old=Path('/home/growthx/releases/a7ece27-catalog-repair/runtime')
new=Path(sys.argv[1])/'runtime'
dump=old/'database.dump'; verified=old/'backup-verified'
assert int(verified.read_text())==dump.stat().st_size
assert json.loads((old/'compose.json').read_text())['name']==json.loads((new/'compose.json').read_text())['name']
os.link(dump,new/'database.dump')
os.link(verified,new/'backup-verified')
(new/'backup-source').write_text(str(old))
print('Existing verified backup retained; database schema unchanged.')
PY
 phase migrate
elif [[ "$mode" == activate ]]; then
 watchdogs=$(pgrep -f '^bash /home/growthx/growthx-watchdog.sh$' || true)
 resume() { for pid in $watchdogs; do kill -CONT "$pid" 2>/dev/null || true; done; }
 trap resume EXIT
 for pid in $watchdogs; do kill -STOP "$pid"; done
 if ! phase activate; then phase rollback; exit 1; fi
 for attempt in $(seq 1 40); do
  if curl -fsS --max-time 5 http://127.0.0.1:3000/health | python3 -c "import json,sys;d=json.load(sys.stdin);sys.exit(0 if d.get('status')=='ok' and d.get('commit')=='$sha' else 1)"; then
   docker tag "growthx-crawler:$sha" growthx-seo-api:latest
   docker tag "growthx-crawler:$sha" growthx-seo-worker:latest
   echo "Healthy discovery release: $sha"
   exit 0
  fi
  sleep 3
 done
 phase rollback
 exit 1
else
 echo 'Usage: release-discovery-repair.sh stage|activate COMMIT [ARTIFACT_DIRECTORY]'
 exit 1
fi
