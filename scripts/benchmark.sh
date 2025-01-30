#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Running PostgreSQL Indexer 100k Event Scale Benchmark ==="
cd "$ROOT_DIR/services/indexer"
npm run build
node --test dist/test/ScaleBenchmark.test.js

echo "=== Scale Benchmark Completed ==="
if [ -f "$ROOT_DIR/.verification/scale_benchmark_report.json" ]; then
  cat "$ROOT_DIR/.verification/scale_benchmark_report.json"
fi
