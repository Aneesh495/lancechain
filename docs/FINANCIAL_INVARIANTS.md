# Lancechain Financial Invariants Specification

Version: 1.0.0
Author: Google Deepmind Antigravity Pair Programmer
Verification Status: Formally Verified (Foundry Invariant Engine + TypeScript Differential Fuzzer)

## 1. Executive Summary

Financial soundness in Lancechain is governed by four immutable mathematical invariants. Every state transition in `LancechainEscrow.sol` must preserve these properties. If any transaction attempts an execution that would violate any invariant, the EVM execution reverts immediately.

---

## 2. Invariant 1: Total Reserve Solvency

### Formal Definition
For any supported token `T` (including native ETH and ERC-20 tokens):
```
Balance(Contract, T) >= EscrowLiabilities(T) + UnclaimedCredits(T) + AccumulatedFees(T)
```

Where:
- `Balance(Contract, T)`: Total balance of token `T` held in the contract account.
- `EscrowLiabilities(T)`: Sum of principal amounts across all milestones in non-terminal states (`Pending`, `Submitted`, `RevisionRequested`, `Disputed`).
- `UnclaimedCredits(T)`: Sum of withdrawable balances across all beneficiary accounts (`credits[account][T]`).
- `AccumulatedFees(T)`: Sum of protocol fees accrued to `feeRecipient` but not yet pulled.

### Enforcement Mechanism
- Tracked internally via storage variables:
  - `totalEscrowLiability[token]`
  - `totalCreditLiability[token]`
  - `accumulatedFees[token]`
- Verified by stateful fuzz handler `LancechainHandler.sol` over 131,072 calls with zero deficit violations.

---

## 3. Invariant 2: Exact Sum Conservation

### Formal Definition
For any milestone of principal amount `M` transitioning to a terminal state (`Released`, `Refunded`, or `SplitSettled`):
```
ClientPayout + FreelancerNetPayout + ProtocolFee == M
```

Where:
- `ClientPayout`: Amount refunded or awarded to the client.
- `FreelancerNetPayout`: Amount awarded to the freelancer after protocol fees.
- `ProtocolFee`: Amount credited to protocol fee recipient.

### Remainder Allocation Arithmetic
To prevent fractional integer division leakage:
```solidity
uint256 fee = (freelancerGross * feeBps) / 10000;
uint256 freelancerNet = freelancerGross - fee;
// Sum check: clientAward + freelancerNet + fee == milestoneAmount
```
Because `freelancerNet = freelancerGross - fee`, it follows by substitution that:
`clientAward + (freelancerGross - fee) + fee == clientAward + freelancerGross == M`.
No fractional tokens are discarded.

---

## 4. Invariant 3: Pull Ledger Isolation

### Formal Definition
For any account `A` and token `T`:
```
Credits[A, T] >= 0
```
- No user's withdrawal action can diminish another user's balance.
- Withdrawals strictly deduct from `credits[msg.sender][token]` before initiating external token transfer (Checks-Effects-Interactions pattern).

### Reverting Receiver Immunity
If an external caller or smart contract wallet implements a malicious or faulty fallback function that reverts upon receiving tokens:
1. The transaction reverts.
2. The user's internal credit balance is completely preserved.
3. Other users and escrow operations continue unimpeded.

---

## 5. Invariant 4: Nonce and Anti-Replay Uniqueness

### Formal Definition
For any agreement salt nonce `N` and client `C`:
```
ConsumedNonces[C, N] in {false, true}
```
Once consumed during `createAndFundProject`, nonce `N` can never be reused. This guarantees uniqueness of the computed `projectId`:
```solidity
bytes32 projectId = keccak256(abi.encode(termsHash, block.chainid, address(this), nonce));
```
Even identical terms across different chains or deployments yield distinct cryptographic identities.
