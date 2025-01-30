# Lancechain SDK and Read API Reference

Version: 1.0.0
Author: Google Deepmind Antigravity Pair Programmer
Standard: Typed TypeScript SDK & OpenAPI JSON Interface

## 1. Protocol SDK (`@lancechain/sdk`)

The SDK provides client interfaces for interacting with `LancechainEscrow.sol` and `LancechainReputation.sol`.

### 1.1 Installation
```bash
npm install @lancechain/sdk ethers
```

### 1.2 Core Modules

- `LancechainClient`: High-level contract client for project lifecycle operations:
  ```typescript
  import { LancechainClient, TermsBuilder } from "@lancechain/sdk";
  import { ethers } from "ethers";

  const provider = new ethers.JsonRpcProvider("http://localhost:8545");
  const signer = new ethers.Wallet(PRIVATE_KEY, provider);

  const client = new LancechainClient(manifest, provider, signer);
  ```

- `TermsBuilder`: Fluent builder for EIP-712 structured agreement terms:
  ```typescript
  const terms = new TermsBuilder()
    .setCounterparties(clientAddr, freelancerAddr)
    .setToken(usdcAddress)
    .addMilestone({
      amount: ethers.parseUnits("1500", 6),
      deliveryDeadline: Math.floor(Date.now() / 1000) + 86400 * 14,
      reviewPeriod: 86400 * 3,
      maxRevisions: 2,
    })
    .setCommittee([arbitrator1, arbitrator2, arbitrator3], 2)
    .build();
  ```

- `SignerHelpers`: Utilities for EIP-712 domain hashing, typed signature generation, and verification:
  ```typescript
  import { SignerHelpers } from "@lancechain/sdk";

  const clientSig = await SignerHelpers.signProjectTerms(signer, domain, terms);
  const isValid = await SignerHelpers.verifySignature(termsHash, clientSig, clientAddr, provider);
  ```

- `BatchOperationsManager`: Batch funding, approvals, and multi-token pull withdrawals:
  ```typescript
  import { BatchOperationsManager } from "@lancechain/sdk";

  const batchMgr = new BatchOperationsManager(client);
  const withdrawalResults = await batchMgr.batchWithdraw([USDC_ADDR, WETH_ADDR]);
  ```

- `SimulationEngine`: Pre-flight transaction dry-run and custom Solidity error decoding:
  ```typescript
  import { SimulationEngine } from "@lancechain/sdk";

  const sim = new SimulationEngine(provider, escrowAddress);
  const result = await sim.simulateAcceptMilestone(clientAddr, projectId, 0);
  if (!result.success) {
    console.error("Revert reason:", result.decodedRevertReason);
  }
  ```

- `InvariantValidator`: Mathematical invariant assertion library:
  ```typescript
  import { InvariantValidator } from "@lancechain/sdk";

  const solvency = InvariantValidator.verifySolvency(contractBal, escrowLiab, credits, fees);
  console.log("Solvent:", solvency.isSolvent, "Delta:", solvency.delta);
  ```

---

## 2. Protocol Read API (`services/api`)

The Read API is a high-performance REST service querying PostgreSQL projection tables.

### Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health, database latency, and connection status. |
| `GET` | `/api/status` | Current indexed block number, reorg depth, and checkpoint hash. |
| `GET` | `/api/projects` | Query projects with optional filters (`client`, `freelancer`, `status`). |
| `GET` | `/api/projects/:id` | Detailed project projection with all milestone schedules. |
| `GET` | `/api/accounts/:address/credits` | Withdrawable balance breakdown by token for an account. |
| `GET` | `/api/reputation/:address` | Score, tier, completed vs disputed count, and rating history. |
| `GET` | `/api/liabilities` | Aggregate protocol liabilities across all active tokens. |
| `GET` | `/api/reconciliation` | Real-time differential verification between chain reserves and liabilities. |
| `GET` | `/api/events` | Cryptographic event audit stream decoded from EVM logs. |
| `GET` | `/api/analytics/summary` | Global counts for projects, milestones, credits, and reorgs. |
| `GET` | `/api/export/projects.csv` | Downloadable CSV audit of all registered projects. |
| `GET` | `/api/export/events.json` | Downloadable JSON dump of non-reorged event history. |
