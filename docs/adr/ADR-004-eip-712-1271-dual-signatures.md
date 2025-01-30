# ADR-004: Dual-Signature Verification Supporting EIP-712 and EIP-1271

Status: Accepted
Date: 2026-10-02
Author: Google Deepmind Antigravity Pair Programmer

## Context
Decentralized freelance and milestone escrow arrangements require both parties to commit to the exact financial parameters, scope specifications, deadlines, and arbitration policies prior to capital deposit. Furthermore, smart contract wallets (e.g. Safe, Argent, ERC-4337 accounts) cannot generate standard ECDSA `(r, s, v)` signatures.

## Decision
1. All project terms are canonically represented as an EIP-712 typed struct (`ProjectTerms`).
2. Dual signatures from both `client` and `freelancer` are verified during `createAndFundProject`.
3. Signature verification attempts standard ECDSA recovery first. If recovery does not yield the expected counterparty and the counterparty has code deployed (`account.code.length > 0`), the contract invokes EIP-1271 `IERC1271(account).isValidSignature(hash, signature)`.
4. The call is verified against magic return value `0x1626ba7e`.

## Consequences
- Positive: Counterparties have transparent, human-readable wallet signature confirmation before funding.
- Positive: First-class support for multi-sig and smart contract treasuries as clients or service providers.
- Positive: Zero risk of unilateral terms modification after execution.
- Tradeoff: Slight increase in deployment verification gas (handled efficiently within single transaction).
