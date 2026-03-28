#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-smoke}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_PATH="$ROOT_DIR/performance/k6/${MODE}.js"
RESULTS_DIR="$ROOT_DIR/performance/results"
SUMMARY_PATH="$RESULTS_DIR/${MODE}-summary.json"
TARGET_FRONTEND_URL="${TARGET_FRONTEND_URL:-http://localhost:3000}"
TARGET_API_URL="${TARGET_API_URL:-}"

if [[ ! -f "$SCRIPT_PATH" ]]; then
  echo "Unknown k6 profile: $MODE" >&2
  exit 1
fi

mkdir -p "$RESULTS_DIR"

run_with_native_k6() {
  k6 run \
    --summary-export "$SUMMARY_PATH" \
    -e TARGET_FRONTEND_URL="$TARGET_FRONTEND_URL" \
    -e TARGET_API_URL="$TARGET_API_URL" \
    "$SCRIPT_PATH"
}

run_with_docker() {
  docker run --rm -i \
    --add-host=host.docker.internal:host-gateway \
    -e TARGET_FRONTEND_URL="${TARGET_FRONTEND_URL/http:\/\/localhost/http:\/\/host.docker.internal}" \
    -e TARGET_API_URL="${TARGET_API_URL/http:\/\/localhost/http:\/\/host.docker.internal}" \
    -v "$ROOT_DIR/performance:/performance" \
    grafana/k6:latest run \
    --summary-export "/performance/results/${MODE}-summary.json" \
    "/performance/k6/${MODE}.js"
}

if command -v k6 >/dev/null 2>&1; then
  run_with_native_k6
elif command -v docker >/dev/null 2>&1; then
  run_with_docker
else
  echo "Install k6 or Docker before running performance tests." >&2
  exit 1
fi

node "$ROOT_DIR/performance/scripts/benchmark-report.mjs" "$SUMMARY_PATH"