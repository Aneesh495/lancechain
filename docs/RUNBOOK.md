# Lancechain Operational Runbook

Version: 1.0.0
Author: Google Deepmind Antigravity Pair Programmer
Standard: Production Deployment & Node Operations

## 1. Prerequisites

- Node.js >= 20.0.0
- Python 3.10+
- Foundry 1.8.0+ (`forge`, `cast`, `anvil`)
- PostgreSQL 16+ running on `localhost:5432`

---

## 2. Environment Setup

### 2.1 Install Dependencies
```bash
npm install
```

### 2.2 Database Initialization
Ensure PostgreSQL is active and create the database:
```bash
createdb lancechain_dev
```

---

## 3. Development Stack Launch

To start the full development environment with a single command:
```bash
bash scripts/dev.sh
```
This script automatically:
1. Launches local Anvil node on port 8545 (chain ID 31337).
2. Deploys `LancechainEscrow.sol`, `LancechainReputation.sol`, and `MockERC20.sol`.
3. Runs database migrations for the reorg-aware indexer.
4. Starts the Read API server on port 3001.
5. Starts the Vite React web frontend on port 3000.

---

## 4. Verification and Testing

Execute the test suites:
```bash
# Run unit tests
bash scripts/test_unit.sh

# Run stateful invariant fuzzing
bash scripts/test_invariants.sh

# Run 10,000 differential model simulations
bash scripts/test_differential.sh

# Run PostgreSQL reorg recovery tests
bash scripts/test_integration.sh

# Run end-to-end lifecycle verification
bash scripts/test_e2e.sh

# Run high-throughput scale benchmark (100k events)
bash scripts/benchmark.sh

# Run full formal acceptance suite (all 10 gates)
bash scripts/run_acceptance.sh

# Verify ACCEPTANCE.json integrity
bash scripts/verify_acceptance.sh
```

---

## 5. Production Operations

### 5.1 Emergency Pause (Circuit Breaker)
`LancechainEscrow.sol` integrates an emergency pause mechanism. If abnormal network activity or token exploits occur:
```bash
cast send --private-key $ADMIN_KEY $ESCROW_ADDRESS "pause()"
```
While paused:
- No new projects can be created or funded.
- Existing locked funds remain frozen in contract storage.
- Payout triggers and milestone approvals are blocked.
- Pull withdrawals can be resumed when unpaused.

To resume operations:
```bash
cast send --private-key $ADMIN_KEY $ESCROW_ADDRESS "unpause()"
```

### 5.2 Indexer Crash Recovery
If the indexer process terminates unexpectedly:
1. Restart the process via `node dist/src/index.js`.
2. The indexer reads the last canonical checkpoint from `indexer_checkpoints`.
3. It fetches new blocks starting from `checkpoint_block + 1`.
4. If the chain tip reorged during downtime, `ReorgEngine` detects the parent hash mismatch and unwinds to the common ancestor automatically.
