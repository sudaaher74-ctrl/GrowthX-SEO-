#!/usr/bin/env bash
set -euo pipefail
cd /mnt/c/Users/siddh/OneDrive/Desktop/growthXserver/portable-ai-visibility
sha=43849af161574538df70a2486f9f29a45dcebf4f
release=/home/growthx/releases/43849af-model-repair
phase() { python3 scripts/deploy-compose-release.py "$1" . /home/growthx/GrowthX-SEO /home/growthx/GrowthX-SEO/.env.laptop "$release" "$sha"; }
watchdogs=$(pgrep -f '^bash /home/growthx/growthx-watchdog.sh$' || true)
resume() { for pid in $watchdogs; do kill -CONT "$pid" 2>/dev/null || true; done; }
trap resume EXIT
for pid in $watchdogs; do kill -STOP "$pid"; done
if ! phase activate; then phase rollback; exit 1; fi
for attempt in $(seq 1 40); do
 if curl -fsS --max-time 5 http://127.0.0.1:3000/health | python3 -c "import json,sys;d=json.load(sys.stdin);sys.exit(0 if d.get('status')=='ok' and d.get('commit')=='$sha' else 1)"; then
  docker tag "growthx-crawler:$sha" growthx-seo-api:latest
  docker tag "growthx-crawler:$sha" growthx-seo-worker:latest
  echo "Healthy model repair release: $sha"
  exit 0
 fi
 sleep 3
done
phase rollback
exit 1
