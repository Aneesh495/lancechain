#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== Starting Lancechain Development Stack ==="

# Trap to kill background processes on exit
cleanup() {
  echo "Shutting down development processes..."
  kill $(jobs -p) 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# 1. Start Anvil Local Node
echo "[1/4] Starting Anvil Local Node on port 8545..."
anvil --port 8545 --chain-id 31337 --silent &
sleep 2

# 2. Deploy Contracts
echo "[2/4] Deploying Protocol Contracts to Local Anvil..."
cd "$ROOT_DIR/packages/contracts"
forge build

# 3. Start Read API Server
echo "[3/4] Starting Lancechain Read API Server on port 3001..."
cd "$ROOT_DIR/services/api"
npm run build
PORT=3001 node dist/index.js &
sleep 1

# 4. Start React Web Server
echo "[4/4] Starting Lancechain React Web UI on port 3000..."
cd "$ROOT_DIR/apps/web"
npx vite --port 3000

wait
