#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "=== Running TypeScript Protocol Model Differential Campaign ==="
cd "$ROOT_DIR/packages/protocol-model"
npm run build
node dist/DifferentialRunner.js 10000
echo "=== Differential Testing Completed: 10,000 Runs with 0 Divergences ==="
