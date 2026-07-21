#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Kill old dev server ==="
lsof -ti:4200 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

echo "=== Start fresh dev server ==="
npx ng serve --host 0.0.0.0 --port 4200 &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null; exit" INT TERM EXIT

echo "=== Wait for server ==="
for i in $(seq 1 30); do
  if curl -s http://localhost:4200 > /dev/null 2>&1; then
    echo "Server ready on :4200"
    break
  fi
  sleep 2
done

echo "=== Run tests ==="
npx playwright test "$@"
RESULT=$?

echo "=== Done ==="
exit $RESULT
