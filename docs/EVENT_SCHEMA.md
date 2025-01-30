# Lancechain Protocol Event Schema

Version: 1.0.0
Author: Google Deepmind Antigravity Pair Programmer
Standard: EVM ABI Log Specification

## 1. Abstract

Every state transition in Lancechain emits strongly-typed EVM event logs. The event topics and data payloads form the immutable source of truth for the reorg-aware indexer and external audit nodes.

---

## 2. Core Protocol Events

### 2.1 `TermsAccepted`
Emitted upon initial project creation and funding.
```solidity
event TermsAccepted(
    bytes32 indexed projectId,
    address indexed client,
    address indexed freelancer,
    address token,
    uint256 totalBudget,
    uint256 milestoneCount,
    bytes32 termsHash
);
```

### 2.2 `MilestoneFunded`
Emitted when milestone capital is locked into the escrow contract.
```solidity
event MilestoneFunded(
    bytes32 indexed projectId,
    uint256 indexed milestoneIndex,
    uint256 amount,
    uint32 deliveryDeadline
);
```

### 2.3 `DeliverableSubmitted`
Emitted when the freelancer submits proof of completion.
```solidity
event DeliverableSubmitted(
    bytes32 indexed projectId,
    uint256 indexed milestoneIndex,
    bytes32 deliverableHash,
    uint32 reviewDeadline
);
```

### 2.4 `RevisionRequested`
Emitted when the client requests formal revisions.
```solidity
event RevisionRequested(
    bytes32 indexed projectId,
    uint256 indexed milestoneIndex,
    bytes32 revisionReasonHash,
    uint8 revisionsUsed,
    uint32 newDeliveryDeadline
);
```

### 2.5 `MilestoneAccepted`
Emitted when the client approves work and releases funds.
```solidity
event MilestoneAccepted(
    bytes32 indexed projectId,
    uint256 indexed milestoneIndex,
    uint256 freelancerNet,
    uint256 feeAmount
);
```

### 2.6 `DisputeOpened`
Emitted when either party escalates to arbitration.
```solidity
event DisputeOpened(
    bytes32 indexed projectId,
    uint256 indexed milestoneIndex,
    address indexed initiator,
    bytes32 disputeReasonHash,
    uint32 disputeTimeout
);
```

### 2.7 `DisputeResolved`
Emitted when an arbitration verdict or fallback is executed.
```solidity
event DisputeResolved(
    bytes32 indexed projectId,
    uint256 indexed milestoneIndex,
    uint256 clientAward,
    uint256 freelancerAward,
    uint256 feeAmount,
    uint8 outcome
);
```

### 2.8 `WithdrawalExecuted`
Emitted when a user pulls accrued funds from the internal credit ledger.
```solidity
event WithdrawalExecuted(
    address indexed account,
    address indexed token,
    address indexed recipient,
    uint256 amount
);
```

### 2.9 `RatingSubmitted`
Emitted by `LancechainReputation.sol` upon counterparty feedback.
```solidity
event RatingSubmitted(
    bytes32 indexed projectId,
    address indexed rater,
    address indexed ratee,
    uint8 score,
    bytes32 feedbackHash
);
```
