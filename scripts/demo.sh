#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=========================================================="
echo "         LANCECHAIN PROTOCOL INTERACTIVE DEMO             "
echo "=========================================================="

echo "Running end-to-end milestone lifecycle demo..."
cd "$ROOT_DIR/packages/protocol-model"
npm run build
node dist/test.js

echo ""
echo "=== Protocol Demo Completed Successfully ==="
echo "All financial invariants verified:"
echo "  [x] EIP-712 / EIP-1271 Signature Verification"
echo "  [x] Milestone Escrow Funding & Isolation"
echo "  [x] Cryptographic Deliverable Artifact Submission (SHA-256)"
echo "  [x] Payout Approval & Protocol Fee Deduction (1%)"
echo "  [x] Non-Reentrant Pull Ledger Withdrawals"
echo "  [x] Autonomous Reputation Score Minting"
echo "  [x] Authorized Arbitration Dispute Split"
echo "=========================================================="
