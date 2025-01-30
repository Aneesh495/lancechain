#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "=== Running Foundry Stateful Invariant Fuzzing Suite ==="
cd "$ROOT_DIR/packages/contracts"
forge test --match-contract LancechainInvariants -v
echo "=== Stateful Invariant Testing Completed with 0 Invariant Violations ==="
