#!/usr/bin/env bash
set -euo pipefail
source_dir=$(git rev-parse --show-toplevel)
sha=$(git rev-parse HEAD)
release="/home/growthx/releases/${sha:0:7}-visibility-openrouter"
live=/home/growthx/GrowthX-SEO
phase() {
  python3 "$source_dir/scripts/deploy-compose-release.py" "$1" "$source_dir" "$live" "$live/.env.laptop" "$release" "$sha"
}
phase prepare
phase build
phase backup
phase migrate </dev/null
watchdogs=$(pgrep -f '^bash /home/growthx/growthx-watchdog.sh$' || true)
resume() { for pid in $watchdogs; do kill -CONT "$pid" 2>/dev/null || true; done; }
trap resume EXIT
for pid in $watchdogs; do kill -STOP "$pid"; done
if ! phase activate; then phase rollback; exit 1; fi
for attempt in $(seq 1 30); do
  if curl -fsS --max-time 5 http://127.0.0.1:3000/health | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get('status') == 'ok' and d.get('commit') == '$sha' else 1)"; then
    docker tag "growthx-crawler:$sha" growthx-seo-api:latest
    docker tag "growthx-crawler:$sha" growthx-seo-worker:latest
    echo "Healthy release: $sha"
    exit 0
  fi
  sleep 3
done
phase rollback
exit 1
