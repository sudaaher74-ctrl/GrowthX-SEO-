#!/usr/bin/env bash
set -u

LOG=${GROWTHX_WATCHDOG_LOG:-/tmp/growthx-watchdog.log}
LOCK=${GROWTHX_WATCHDOG_LOCK:-/tmp/growthx-watchdog-v2.lock}
PROJECT=${GROWTHX_PROJECT_DIR:-/home/growthx/GrowthX-SEO}
CLOUDFLARED=${CLOUDFLARED_PATH:-$HOME/.local/bin/cloudflared}
CONFIG=${CLOUDFLARED_CONFIG:-$HOME/.cloudflared/config.yml}
TUNNEL_NAME=${CLOUDFLARED_TUNNEL_NAME:-growthx-laptop}
public_failures=0

log() { echo "$(date -Is) $*" >> "$LOG"; }

kill_tunnel() {
  local pid
  for pid in $(pgrep -x cloudflared || true); do kill "$pid" 2>/dev/null || true; done
  sleep 3
  for pid in $(pgrep -x cloudflared || true); do kill -9 "$pid" 2>/dev/null || true; done
}

start_tunnel() {
  log "starting cloudflared tunnel"
  nohup setsid "$CLOUDFLARED" --config "$CONFIG" tunnel --protocol http2 run "$TUNNEL_NAME" >/tmp/growthx-cloudflared.log 2>&1 </dev/null 9>&- &
  sleep 10
}

start_stack() {
  cd "$PROJECT" || return 1
  docker compose --env-file .env.laptop up -d --no-recreate postgres redis api worker >/tmp/growthx-docker-start.log 2>&1
}

check_local_api() { curl -fsS --max-time 8 http://127.0.0.1:3000/health >/dev/null; }
check_public_api() { curl -fsS --max-time 15 https://api.reigel.in/health >/dev/null; }

check_tunnel_connected() {
  local port
  # cloudflared allocates the first available local metrics port in this range.
  # Any connected replica is sufficient; do not kill one because an external
  # hairpin probe failed or another replica is reconnecting.
  for port in 20241 20242 20243 20244 20245; do
    if curl -fsS --max-time 2 "http://127.0.0.1:$port/metrics" 2>/dev/null |
      awk '$1 == "cloudflared_tunnel_ha_connections" && $2 > 0 { connected=1 } END { exit !connected }'; then
      return 0
    fi
  done
  return 1
}

check_and_repair_public_api() {
  if check_public_api; then public_failures=0; return; fi
  public_failures=$((public_failures + 1))
  log "public API probe failed ($public_failures/3); tunnel left running"
  if [ "$public_failures" -lt 3 ]; then return; fi
  public_failures=0
  if ! check_local_api; then
    log "local API unavailable; tunnel left running (origin repair handled separately)"
  elif check_tunnel_connected; then
    log "local API and Cloudflare connections healthy; external probe failure did not restart tunnel"
  else
    log "three public probes failed and no Cloudflare connection is healthy; restarting tunnel"
    kill_tunnel
    start_tunnel
    if check_public_api; then log "public API recovered"; else log "public API still failing after tunnel restart"; fi
  fi
}

main() {
  exec 9>"$LOCK"
  if ! flock -w 70 9; then return; fi
  local local_failures=0
  log "watchdog started (three-probe repair; connected tunnels and existing containers preserved)"
  while true; do
    if ! start_stack; then log "docker stack start/check failed"; sleep 60; continue; fi
    if ! check_local_api; then
      local_failures=$((local_failures + 1))
      log "local API probe failed ($local_failures/3); worker left running"
      if [ "$local_failures" -ge 3 ]; then
        log "local API failed three consecutive probes; restarting API only"
        (cd "$PROJECT" && docker compose --env-file .env.laptop restart -t 180 api >/tmp/growthx-docker-repair.log 2>&1) || true
        local_failures=0
        sleep 20
      fi
    else local_failures=0; fi
    if ! pgrep -x cloudflared >/dev/null; then log "cloudflared not running"; start_tunnel; fi
    check_and_repair_public_api
    sleep 60
  done
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main "$@"; fi
