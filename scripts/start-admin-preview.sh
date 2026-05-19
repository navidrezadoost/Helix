#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_LOG="$ROOT_DIR/.tmp-preview-api.log"
mkdir -p "$ROOT_DIR"

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" >/dev/null 2>&1; then
    kill "$API_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

cd "$ROOT_DIR"
node laravel-helix-api/preview-server.mjs >"$API_LOG" 2>&1 &
API_PID=$!

echo "Preview API running on http://localhost:8000 (pid: $API_PID)"
echo "API logs: $API_LOG"

cd "$ROOT_DIR/packages/admin-panel"
npm run dev -- --host 0.0.0.0 --port 3001
