#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== [1/2] Running PostgreSQL Reorg Recovery and Interruption Tests ==="
cd "$ROOT_DIR/services/indexer"
npm run build
npm test

echo "=== [2/2] Running Read API End-to-End Integration Tests ==="
cd "$ROOT_DIR/services/api"
npm run build
npm test

echo "=== All Integration Tests Passed Successfully ==="
