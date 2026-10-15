#!/usr/bin/env bash
set -euo pipefail
source_dir=$(git rev-parse --show-toplevel)
artifact=$(realpath "$1")
backup_release=$(realpath "$2")
sha=$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["commit"])' "$artifact/revision.json")
release="/home/growthx/releases/${sha:0:7}-visibility-openrouter"
live=/home/growthx/GrowthX-SEO
phase() { python3 "$source_dir/scripts/deploy-compose-release.py" "$1" "$source_dir" "$live" "$live/.env.laptop" "$release" "$sha"; }
python3 "$source_dir/scripts/build-code-release.py" "$artifact" "$source_dir"
phase prepare
# Reuse only a fresh, verified backup for the same stack and unchanged schema.
for attempt in $(seq 1 180); do test -f "$backup_release/runtime/backup-verified" && break; sleep 5; done
python3 - "$source_dir" "$backup_release" "$release" "$sha" <<'PY'
import json,os,subprocess,sys,time
from pathlib import Path
source,previous,current=map(lambda x:Path(x).resolve(),sys.argv[1:4]);sha=sys.argv[4]
if not all(p.is_relative_to('/home/growthx/releases') for p in [previous,current]):raise SystemExit('Release path outside release directory.')
old_config=json.loads((previous/'runtime/compose.json').read_text());new_config=json.loads((current/'runtime/compose.json').read_text())
if old_config['name']!=new_config['name']:raise SystemExit('Backup belongs to another stack.')
old_sha=old_config['services']['api']['environment']['GIT_COMMIT']
changed=subprocess.check_output(['git','-C',str(source),'diff','--name-only',old_sha,sha,'--','growthx-ai-crawler/prisma'],text=True).strip()
if changed:raise SystemExit('Schema changed; create a new backup instead.')
dump=previous/'runtime/database.dump';verified=previous/'runtime/backup-verified'
if int(verified.read_text())!=dump.stat().st_size or time.time()-verified.stat().st_mtime>3600:raise SystemExit('Fresh verified backup required.')
os.link(dump,current/'runtime/database.dump')
(current/'runtime/backup-verified').write_text(verified.read_text())
(current/'runtime/backup-source').write_text(str(previous))
print('Fresh verified backup retained for final code release.')
PY
phase migrate </dev/null
watchdogs=$(pgrep -f '^bash /home/growthx/growthx-watchdog.sh$' || true)
resume() { for pid in $watchdogs; do kill -CONT "$pid" 2>/dev/null || true; done; }
trap resume EXIT
for pid in $watchdogs; do kill -STOP "$pid"; done
if ! phase activate; then phase rollback; exit 1; fi
for attempt in $(seq 1 40); do
  if curl -fsS --max-time 5 http://127.0.0.1:3000/health | python3 -c "import json,sys;d=json.load(sys.stdin);sys.exit(0 if d.get('status')=='ok' and d.get('commit')=='$sha' else 1)"; then
    docker tag "growthx-crawler:$sha" growthx-seo-api:latest
    docker tag "growthx-crawler:$sha" growthx-seo-worker:latest
    echo "Healthy release: $sha"
    exit 0
  fi
  sleep 3
done
phase rollback
exit 1