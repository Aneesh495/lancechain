# Lancechain Arbitration Model Specification

Version: 1.0.0
Author: Google Deepmind Antigravity Pair Programmer
Model: Multi-Signature Committee Quorum Arbitration

## 1. Abstract

Lancechain implements a decentralized, committee-based arbitration model designed to resolve commercial and technical disputes without centralized custody. Dispute resolution relies on threshold cryptography, bounded review timers, and fallback policies.

---

## 2. Committee Structure and Selection

When an agreement is authored, the counterparties specify:
1. `committee`: An array of between 1 and 7 distinct, non-counterparty addresses.
2. `quorumThreshold`: The minimum number of arbitrator approvals required (e.g. 2 of 3, 3 of 5).
3. `disputeWindow`: The maximum time allocated for the committee to render a verdict (e.g. 7 days).
4. `timeoutPolicy`: Fallback rule if the committee fails to reach quorum within the window.

### Counterparty Exclusion Rule
Neither the `client` nor the `freelancer` address may be included in the dispute committee. The smart contract constructor and terms validation enforce strict distinction between parties and adjudicators.

---

## 3. Dispute Resolution Workflow

### Phase 1: Escalation
Either party may open a dispute during the milestone review window:
- Milestone state shifts to `Disputed`.
- Normal approval and auto-approval countdowns are frozen.
- Milestone principal remains locked in the escrow contract.

### Phase 2: Evidence Submission
Parties submit off-chain evidence packets (commit histories, benchmark outputs, audit reports) anchored via SHA-256 digests or IPFS content identifiers.

### Phase 3: Quorum Verdict Execution
Arbitrators review evidence and sign an EIP-712 structured verdict:
```solidity
struct DisputeResolution {
    bytes32 projectId;
    uint256 milestoneIndex;
    uint16 clientSplitBps;
    uint16 freelancerSplitBps;
    uint256 nonce;
}
```
Any participant may submit the verdict with at least `quorumThreshold` distinct arbitrator signatures by invoking:
```solidity
function resolveDisputeWithQuorum(
    bytes32 projectId,
    uint256 milestoneIndex,
    uint16 clientSplitBps,
    uint16 freelancerSplitBps,
    bytes[] calldata arbitratorSignatures
) external;
```
The contract validates:
1. `clientSplitBps + freelancerSplitBps == 10000`.
2. Each signature is valid and belongs to a designated committee member.
3. No arbitrator signature is duplicated.
4. Quorum threshold is met or exceeded.

---

## 4. Timeout Fallback Policies

If the committee is inactive, unreachable, or deadlocked past the `disputeWindow`, any user may call `resolveDisputeTimeout(projectId, milestoneIndex)`. The contract applies the pre-agreed policy:

1. `RefundToClient`: Milestone principal is refunded 100% to the client pull ledger.
2. `ReleaseToFreelancer`: Milestone principal (net of fees) is released 100% to the freelancer.
3. `SplitEvenly`: 50% refunded to client, 50% (net of fees) released to freelancer.

This ensures capital cannot be trapped indefinitely in deadlocked escrows.

---

## 5. Mutual Co-Signed Settlement

At any time during a dispute, the client and freelancer may bypass the committee by co-signing a mutual agreement via:
```solidity
function executeMutualSettlement(
    bytes32 projectId,
    uint256 milestoneIndex,
    uint16 clientSplitBps,
    uint16 freelancerSplitBps,
    bytes calldata clientSig,
    bytes calldata freelancerSig
) external;
```
This enables flexible settlement when counterparties reach direct consensus after negotiations.
