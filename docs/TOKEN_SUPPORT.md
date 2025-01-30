# Lancechain Token Support and Accounting

Version: 1.0.0
Author: Google Deepmind Antigravity Pair Programmer
Standard: ERC-20 & Native EVM Currency

## 1. Overview

Lancechain accommodates both native EVM gas tokens (Ether) and standardized ERC-20 fungible tokens. All token operations use OpenZeppelin SafeERC20 wrappers to handle non-standard implementations (e.g. USDT missing boolean return values).

---

## 2. Supported Asset Classes

### 2.1 Native Ether (`address(0)`)
- Designated by setting `token = address(0)`.
- Funding is verified via `msg.value == totalBudget`.
- Payouts and refunds are credited to the internal pull ledger.
- Calling `withdraw(address(0), recipient)` transfers native ETH using call value:
  ```solidity
  (bool success, ) = recipient.call{value: amount}("");
  if (!success) revert WithdrawalFailed();
  ```

### 2.2 Standard ERC-20 Tokens (USDC, USDT, DAI, WETH)
- Designated by specifying the token's deployed contract address.
- Client approves the Escrow contract for the total project budget.
- Contract pulls tokens via `SafeERC20.safeTransferFrom`.
- Supports any standard decimal precision (e.g. 6 decimals for USDC/USDT, 18 decimals for DAI/WETH).

---

## 3. Defense Against Token Anomalies

### 3.1 Fee-on-Transfer Tokens
Certain tokens deduct a percentage fee during transfers. If allowed unchecked, this would cause contract insolvency because the received tokens would be less than the recorded liabilities.

Lancechain verifies actual received balances during project funding:
```solidity
uint256 balanceBefore = IERC20(terms.token).balanceOf(address(this));
IERC20(terms.token).safeTransferFrom(funder, address(this), totalBudget);
uint256 balanceAfter = IERC20(terms.token).balanceOf(address(this));

if (balanceAfter - balanceBefore != totalBudget) {
    revert BalanceMismatch();
}
```
If the token takes a transfer fee, the transaction reverts immediately.

### 3.2 Rebasing and Elastic Supply Tokens
Tokens with dynamic, rebasing balances (e.g. stETH, AMPL) are strictly incompatible with fixed-ledger escrow accounting. Escrow agreements must use static-balance wrapped representations (e.g. wstETH instead of stETH).

---

## 4. Multi-Token Internal Ledger

All balances and liabilities in `LancechainEscrow.sol` are isolated on a per-token basis:
```solidity
mapping(address => mapping(address => uint256)) private credits;
mapping(address => uint256) public totalEscrowLiability;
mapping(address => uint256) public totalCreditLiability;
mapping(address => uint256) public accumulatedFees;
```
Token balances are strictly partitioned so activity in one token market cannot affect the solvency of another.
