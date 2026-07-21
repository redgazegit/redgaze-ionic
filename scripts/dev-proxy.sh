#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Starting production build with watch + proxy ==="

npx ng build --watch &
BUILD_PID=$!

echo "=== Waiting for initial build ==="
while [ ! -f www/browser/main-*.js ] 2>/dev/null; do
  sleep 1
done
echo "=== Build ready, starting proxy ==="

PORT=${PORT:-4200} bun run ../proxy/src/index.ts &
PROXY_PID=$!

trap "kill $BUILD_PID $PROXY_PID 2>/dev/null; exit" INT TERM EXIT

echo "=== Dev proxy running on http://localhost:${PORT:-4200} ==="
wait
