# ADR-001: Immutable Financial Invariants

Status: Accepted
Date: 2026-10-02
Author: Google Deepmind Antigravity Pair Programmer

## Context
Escrow protocols commonly suffer from edge-case vulnerabilities where token balances diverge from internal liabilities due to rounding errors, unaccounted fees, fee-on-transfer discrepancies, or contract balance drains.

## Decision
We establish explicit, immutable financial invariants enforced both within the smart contract storage logic and verified via stateful invariant fuzzing:
1. `ContractBalance >= EscrowLiabilities + UnclaimedCredits + AccumulatedFees`.
2. `MilestoneAmount == ClientAward + FreelancerNet + ProtocolFee`.
3. Safe remainder allocation ensuring zero fractional token leakage.

## Consequences
- Positive: Guarantees 100% solvency across all supported tokens at every block height.
- Positive: Prevents insolvency attacks and token drain bugs.
- Tradeoff: Disallows fee-on-transfer tokens that deduct unexpected tolls during deposit.
