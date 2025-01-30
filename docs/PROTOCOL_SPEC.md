# Lancechain Protocol Specification

Version: 1.0.0
Status: Production Candidate
Target EVM: Cancun (via_ir = true, solc 0.8.27)

## 1. Abstract

Lancechain is an on-chain, verifiable milestone escrow protocol designed for trust-minimized technical engagements, freelance contracts, and decentralized milestone settlements. The protocol establishes rigorous mathematical guarantees:
- Dual-signature EIP-712 and EIP-1271 counterparty commitment before funding.
- Strict milestone state machine governing delivery, review, revision, and disputes.
- Sum-conserved settlement ensuring that all token amounts are accounted for without leakage or fractional loss.
- Non-reentrant pull withdrawal ledger preventing denial of service, griefing, or malicious recipient contract reverts.
- Authorized committee arbitration with cryptographic multi-signature quorum.
- Decentralized reputation scoring oracle updating performance metrics upon settlement.

---

## 2. Core Architecture

The protocol is partitioned into clean, modular layers:
1. Smart Contract Core (`packages/contracts`):
   - `LancechainEscrow.sol`: Main escrow state machine, liability ledger, and settlement engine.
   - `LancechainReputation.sol`: Sovereign reputation ledger recording ratings, completion ratios, and dispute frequencies.
   - `ILancechainEscrow.sol`: Standardized escrow interface.
   - `ILancechainReputation.sol`: Standardized reputation interface.
2. Independent Reference Model (`packages/protocol-model`):
   - Pure TypeScript formal model simulating the exact EVM state machine and accounting rules for differential fuzzing.
3. Protocol SDK (`packages/sdk`):
   - Strictly typed client library facilitating terms generation, EIP-712 signing, transaction simulation, batch operations, and event decoding.
4. Reorg-Aware Indexer (`services/indexer`):
   - PostgreSQL backed event ingestion pipeline maintaining a rollback journal (depth 128) and synchronized projection tables.
5. Protocol Read API (`services/api`):
   - High-performance Express REST service exposing live project state, credit balances, liability reports, audit logs, and analytics.
6. Web Marketplace (`apps/web`):
   - Modern React 18 and Vite application providing full agreement negotiation, deliverable submission, dispute rooms, and pull withdrawal management.

---

## 3. Terms Verification and Signing

Project agreements require mutual acceptance by both the client and freelancer before capital can be deposited. Terms are structured as typed data complying with EIP-712.

### 3.1 Domain Separator
```
EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)
```
- `name`: "LancechainEscrow"
- `version`: "1"
- `chainId`: 31337 (local Anvil) or target network chain ID
- `verifyingContract`: deployed address of `LancechainEscrow.sol`

### 3.2 Type Definitions
```
ProjectTerms(address client,address freelancer,address token,uint32 disputeWindow,uint8 quorumThreshold,uint8 timeoutPolicy,uint16 feeBps,address feeRecipient,bytes32 agreementHash,uint256 nonce,uint256 expiration,MilestoneTerms[] milestones,address[] committee)
MilestoneTerms(uint256 amount,uint32 deliveryDeadline,uint32 reviewPeriod,uint8 maxRevisions)
```

### 3.3 Acceptance Semantics
Contract wallets are supported via EIP-1271 (`isValidSignature(bytes32,bytes)` returning `0x1626ba7e`). Signatures are strictly bound to terms hash, chain ID, verifying contract, and a unique salt nonce to prevent cross-contract replay.

---

## 4. Financial Solvency and Accounting

The protocol enforces four fundamental financial invariants on every block:

1. **Total Solvency Invariant**:
   `ContractTokenBalance >= Sum(ActiveMilestoneLiabilities) + Sum(UnclaimedWithdrawableCredits) + AccumulatedProtocolFees`

2. **Sum Conservation Invariant**:
   `MilestonePrincipal == ClientPayout + FreelancerNetPayout + ProtocolFee`

3. **Isolated Pull Ledger**:
   `Credits[account][token] >= 0` (negative balances strictly prohibited by integer arithmetic)

4. **Zero Lost Tokens**:
   All fee calculations use exact integer arithmetic with remainder allocation to avoid truncation losses.

---

## 5. Settlement and Pull Withdrawals

Direct token transfers inside state-transition routines (e.g. `acceptMilestone`, `resolveDispute`) are prohibited to eliminate attack surfaces:
- No reentrancy risks during complex state updates.
- No possibility of a malicious smart contract reverting a transfer to block counterparty settlement.
- Predictable and bounded gas consumption for approval calls.

When a milestone is accepted or settled, funds are credited directly to internal mapping balances (`credits[recipient][token] += amount`). Beneficiaries withdraw their funds at their discretion via `withdraw(token, recipient)`. If a recipient address reverts, the transaction safely reverts without corrupting global protocol state.
