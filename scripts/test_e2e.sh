#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Running Complete End-to-End Lifecycle Scenario ==="
cd "$ROOT_DIR/packages/protocol-model"
npm run build
node dist/test.js

echo "=== End-to-End Protocol Lifecycle Scenario Completed Successfully ==="
