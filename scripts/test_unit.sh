#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "=== [1/2] Running Foundry Contract Unit Tests ==="
cd "$ROOT_DIR/packages/contracts"
forge test --match-path "test/LancechainEscrow.t.sol" -v

echo "=== [2/2] Running TypeScript SDK Unit Tests ==="
cd "$ROOT_DIR/packages/sdk"
npm test

echo "=== All Unit Tests Passed Successfully ==="
