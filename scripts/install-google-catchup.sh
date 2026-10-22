#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
install -d -m 755 /usr/local/lib/growthx-server
install -m 644 "$here/google-catchup-sync.cjs" /usr/local/lib/growthx-server/google-catchup-sync.cjs
cat > /usr/local/lib/growthx-server/google-catchup.sh <<'SH'
#!/usr/bin/env bash
set -euo pipefail
docker inspect growthx-seo-api-1 >/dev/null
docker cp /usr/local/lib/growthx-server/google-catchup-sync.cjs growthx-seo-api-1:/app/google-catchup-sync.cjs
exec docker exec growthx-seo-api-1 timeout 1800 node /app/google-catchup-sync.cjs
SH
chmod 755 /usr/local/lib/growthx-server/google-catchup.sh
cat > /etc/systemd/system/growthx-google-catchup.service <<'UNIT'
[Unit]
Description=Catch up Google data missed while the GrowthX laptop was offline
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service
[Service]
Type=oneshot
ExecStart=/usr/local/lib/growthx-server/google-catchup.sh
TimeoutStartSec=31min
UNIT
cat > /etc/systemd/system/growthx-google-catchup.timer <<'UNIT'
[Unit]
Description=Check for stale Google data every fifteen minutes
[Timer]
OnBootSec=45s
OnUnitInactiveSec=15min
AccuracySec=15s
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now growthx-google-catchup.timer
systemctl start --no-block growthx-google-catchup.service
systemctl list-timers growthx-google-catchup.timer --no-pager
