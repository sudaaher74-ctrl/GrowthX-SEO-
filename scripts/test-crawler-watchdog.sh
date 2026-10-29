#!/usr/bin/env bash
set -eu
test_dir=$(mktemp -d)
trap 'rm -f "$test_dir/probes.log"; rmdir "$test_dir"' EXIT
export GROWTHX_WATCHDOG_LOG="$test_dir/probes.log"
source "$(dirname "${BASH_SOURCE[0]}")/crawler-watchdog.sh"

repairs=0
connected=1
origin_healthy=1
public_healthy=0
check_public_api() { [ "$public_healthy" -eq 1 ]; }
check_local_api() { [ "$origin_healthy" -eq 1 ]; }
check_tunnel_connected() { [ "$connected" -eq 1 ]; }
kill_tunnel() { repairs=$((repairs + 1)); }
start_tunnel() { :; }

check_and_repair_public_api
check_and_repair_public_api
[ "$repairs" -eq 0 ]
[ "$public_failures" -eq 2 ]
check_and_repair_public_api
[ "$repairs" -eq 0 ]
[ "$public_failures" -eq 0 ]

connected=0
check_and_repair_public_api
check_and_repair_public_api
[ "$repairs" -eq 0 ]
check_and_repair_public_api
[ "$repairs" -eq 1 ]

check_and_repair_public_api
public_healthy=1
check_and_repair_public_api
[ "$public_failures" -eq 0 ]
public_healthy=0
origin_healthy=0
check_and_repair_public_api
check_and_repair_public_api
check_and_repair_public_api
[ "$repairs" -eq 1 ]
echo 'Watchdog recovery: transient failures, connected replicas, reset and origin failure checks passed.'
