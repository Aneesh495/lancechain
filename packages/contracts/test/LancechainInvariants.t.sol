// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Test, console} from "forge-std/Test.sol";
import {LancechainEscrow} from "../src/LancechainEscrow.sol";
import {LancechainReputation} from "../src/LancechainReputation.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {LancechainHandler} from "./handlers/LancechainHandler.sol";

contract LancechainInvariantsTest is Test {
    LancechainEscrow public escrow;
    LancechainReputation public reputation;
    MockERC20 public token18;
    MockERC20 public usdc6;
    LancechainHandler public handler;

    function setUp() public {
        escrow = new LancechainEscrow();
        reputation = new LancechainReputation(address(escrow));
        escrow.setReputationContract(address(reputation));

        token18 = new MockERC20("Test Dai", "DAI", 18);
        usdc6 = new MockERC20("USD Coin", "USDC", 6);

        handler = new LancechainHandler(escrow, reputation, token18, usdc6);

        targetContract(address(handler));
    }

    // Invariant 1: Total Liability per asset always equals Escrow Liability + Credit Liability
    function invariant_TotalLiabilityAccountingIdentity() public view {
        address[3] memory tokens = [address(0), address(token18), address(usdc6)];
        for (uint256 i = 0; i < 3; i++) {
            address tok = tokens[i];
            (uint256 escrowLiab, uint256 creditLiab, uint256 totalLiab) = escrow.getLiabilities(tok);
            assertEq(totalLiab, escrowLiab + creditLiab);
        }
    }

    // Invariant 2: Actual token balance must always be at least accounted liability (surplus permitted, deficit impossible)
    function invariant_SolvencyActualBalanceGteLiability() public view {
        // Native ETH
        (,, uint256 nativeLiab) = escrow.getLiabilities(address(0));
        assertGe(address(escrow).balance, nativeLiab);

        // ERC-20 (18 decimals)
        (,, uint256 token18Liab) = escrow.getLiabilities(address(token18));
        assertGe(token18.balanceOf(address(escrow)), token18Liab);

        // ERC-20 (6 decimals)
        (,, uint256 usdc6Liab) = escrow.getLiabilities(address(usdc6));
        assertGe(usdc6.balanceOf(address(escrow)), usdc6Liab);
    }

    // Invariant 3: Sum of credits across all actors equals totalCreditLiability for each asset
    function invariant_ActorCreditsSumToCreditLiability() public view {
        address[3] memory tokens = [address(0), address(token18), address(usdc6)];
        address[3] memory actors = [handler.client(), handler.freelancer(), handler.feeRecipient()];

        for (uint256 t = 0; t < 3; t++) {
            address tok = tokens[t];
            uint256 sumCredits = 0;
            for (uint256 a = 0; a < 3; a++) {
                sumCredits += escrow.getCredits(actors[a], tok);
            }
            (, uint256 creditLiab,) = escrow.getLiabilities(tok);
            assertEq(sumCredits, creditLiab);
        }
    }

    // Invariant 4: Report transition statistics
    function invariant_TransitionMetrics() public view {
        uint256 succ = handler.successfulTransitions();
        uint256 attempts = handler.attemptCount();
        uint256 revs = handler.revertCount();
        assertTrue(attempts >= succ);
        assertGe(attempts, revs);
    }
}
