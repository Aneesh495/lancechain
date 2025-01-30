# ADR-002: Pull Withdrawals Pattern

Status: Accepted
Date: 2026-10-02
Author: Google Deepmind Antigravity Pair Programmer

## Context
Direct push payouts (initiating `transfer` or `call.value` inside milestone approval or dispute resolution) expose contracts to reentrancy, griefing, and denial of service if the receiving party is a contract that intentionally reverts.

## Decision
All payouts, refunds, and fee releases credit an internal ledger mapping:
```solidity
credits[recipient][token] += amount;
```
Beneficiaries must call `withdraw(token, recipient)` in an independent transaction to transfer their funds out of the contract.

## Consequences
- Positive: Reverting recipient contracts cannot block milestone approvals or counterparty settlements.
- Positive: State transition functions have deterministic, bounded gas costs.
- Positive: Eliminates reentrancy risks during state machine updates.
- Tradeoff: Users must submit an extra transaction to withdraw funds to their wallet.
