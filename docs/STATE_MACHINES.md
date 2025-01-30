# Lancechain State Machine Specification

Version: 1.0.0
Author: Deepmind Antigravity Pair Programmer
Standard: Formal EVM Transition Guard

## 1. Overview

Lancechain operates as a strictly deterministic, bounded state machine. Milestone progression is guarded by authorized caller validation, deadline enforcement, revision quotas, and dispute timeouts.

---

## 2. Milestone State Definitions

Milestones exist in one of seven enumerated states:

| Value | State Name | Meaning |
|---|---|---|
| 0 | `Pending` | Initial state. Milestone principal is funded and held in escrow. Delivery is pending. |
| 1 | `Submitted` | Freelancer has submitted deliverable artifact hash. Review timer is active. |
| 2 | `RevisionRequested` | Client requested formal changes. Delivery deadline extended by agreed revision window. |
| 3 | `Disputed` | Formal claim escalated to authorized dispute committee. Escrow payouts are frozen. |
| 4 | `Released` | Terminal state. Milestone accepted; net funds credited to freelancer pull ledger. |
| 5 | `Refunded` | Terminal state. Milestone timed out or cancelled; funds credited to client pull ledger. |
| 6 | `SplitSettled` | Terminal state. Quorum verdict or mutual compromise executed with split distribution. |

---

## 3. Transition Rules and Permissions

### 3.1 `createAndFundProject`
- Initial State: Empty / Non-existent
- Resulting State: Every milestone initialized to `Pending`
- Caller: Client or designated funder
- Preconditions:
  - Both Client and Freelancer EIP-712/1271 signatures valid.
  - Native ETH value or ERC-20 token allowance equal to total project budget.
  - Nonce unused. Expiration timestamp in the future.

### 3.2 `submitDeliverable`
- Transition: `Pending` -> `Submitted` or `RevisionRequested` -> `Submitted`
- Caller: Freelancer only
- Preconditions:
  - Current time <= `deliveryDeadline`.
  - Non-zero `deliverableHash` provided.
- Postconditions:
  - Milestone state set to `Submitted`.
  - `reviewDeadline` set to `block.timestamp + reviewPeriod`.

### 3.3 `acceptMilestone`
- Transition: `Submitted` -> `Released`
- Caller: Client only
- Preconditions:
  - Milestone is in `Submitted` state.
- Postconditions:
  - Platform fee deducted (`amount * feeBps / 10000`) and credited to `feeRecipient`.
  - Freelancer net credited (`amount - fee`) to Freelancer pull ledger.
  - Project milestone liability decremented.
  - Reputation completion event recorded.

### 3.4 `requestRevision`
- Transition: `Submitted` -> `RevisionRequested`
- Caller: Client only
- Preconditions:
  - Milestone is in `Submitted` state.
  - Current time <= `reviewDeadline`.
  - `revisionsUsed < maxRevisions`.
- Postconditions:
  - `revisionsUsed` incremented.
  - `deliveryDeadline` set to `block.timestamp + extensionSeconds`.
  - `revisionReasonHash` recorded on-chain.

### 3.5 `finalizeMilestone` (Auto-Approval Timeout)
- Transition: `Submitted` -> `Released`
- Caller: Freelancer (or any caller after deadline)
- Preconditions:
  - Milestone is in `Submitted` state.
  - Current time > `reviewDeadline`.
- Postconditions:
  - Automatically executes standard acceptance and release to prevent client ghosting.

### 3.6 `claimDeliveryTimeout`
- Transition: `Pending` -> `Refunded` or `RevisionRequested` -> `Refunded`
- Caller: Client only
- Preconditions:
  - Current time > `deliveryDeadline`.
- Postconditions:
  - Milestone amount refunded directly to Client pull ledger.

### 3.7 `openDispute`
- Transition: `Submitted` -> `Disputed` or `RevisionRequested` -> `Disputed`
- Caller: Client or Freelancer
- Preconditions:
  - Counterparty disagreement before review expiration.
- Postconditions:
  - Milestone state set to `Disputed`.
  - `disputeTimeout` set to `block.timestamp + disputeWindow`.

### 3.8 `resolveDisputeWithQuorum`
- Transition: `Disputed` -> `SplitSettled`
- Caller: Any actor presenting signed committee quorum
- Preconditions:
  - Valid signatures from at least `quorumThreshold` unique committee members.
  - Client and Freelancer split basis points sum to exactly 10,000 (`clientSplitBps + freelancerSplitBps == 10000`).
- Postconditions:
  - Client award credited to Client pull ledger.
  - Freelancer award (minus prorated fee) credited to Freelancer pull ledger.
  - Remainder accounted to the exact integer unit.

### 3.9 `resolveDisputeTimeout`
- Transition: `Disputed` -> `Refunded`, `Released`, or `SplitSettled`
- Caller: Any actor after dispute window expires without quorum
- Preconditions:
  - Current time > `disputeTimeout`.
- Postconditions:
  - Applies project's predefined `TimeoutPolicy`:
    1. `RefundToClient`: Full refund to client.
    2. `ReleaseToFreelancer`: Full release to freelancer.
    3. `SplitEvenly`: 50/50 split settlement.
