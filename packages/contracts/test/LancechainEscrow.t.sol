// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Test, console} from "forge-std/Test.sol";
import {LancechainEscrow} from "../src/LancechainEscrow.sol";
import {LancechainReputation} from "../src/LancechainReputation.sol";
import {ILancechainEscrow} from "../src/interfaces/ILancechainEscrow.sol";
import {ILancechainReputation} from "../src/interfaces/ILancechainReputation.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockERC1271Wallet} from "./mocks/MockERC1271Wallet.sol";
import {RevertingReceiver} from "./mocks/RevertingReceiver.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract LancechainEscrowTest is Test {
    LancechainEscrow public escrow;
    LancechainReputation public reputation;
    MockERC20 public token18;
    MockERC20 public usdc6;

    uint256 internal clientKey = 0xA11CE;
    uint256 internal freelancerKey = 0xB0B;
    uint256 internal feeRecipientKey = 0xFEE;
    uint256 internal arbKey1 = 0xAA1;
    uint256 internal arbKey2 = 0xAA2;
    uint256 internal arbKey3 = 0xAA3;
    uint256 internal outsiderKey = 0xBAD;

    address public client;
    address public freelancer;
    address public feeRecipient;
    address public arb1;
    address public arb2;
    address public arb3;
    address public outsider;

    bytes32 internal constant DELIVERABLE_HASH = keccak256("DELIVERABLE_V1");
    bytes32 internal constant AGREEMENT_HASH = keccak256("SOW_DOCUMENT_V1");

    function setUp() public {
        client = vm.addr(clientKey);
        freelancer = vm.addr(freelancerKey);
        feeRecipient = vm.addr(feeRecipientKey);
        arb1 = vm.addr(arbKey1);
        arb2 = vm.addr(arbKey2);
        arb3 = vm.addr(arbKey3);
        outsider = vm.addr(outsiderKey);

        // Sort arbitrators
        _sortArbitrators();

        vm.deal(client, 1000 ether);
        vm.deal(freelancer, 10 ether);
        vm.deal(outsider, 10 ether);

        escrow = new LancechainEscrow();
        reputation = new LancechainReputation(address(escrow));
        escrow.setReputationContract(address(reputation));

        token18 = new MockERC20("Test Dai", "DAI", 18);
        usdc6 = new MockERC20("USD Coin", "USDC", 6);

        token18.mint(client, 1_000_000 ether);
        usdc6.mint(client, 1_000_000 * 1e6);

        vm.prank(client);
        token18.approve(address(escrow), type(uint256).max);
        vm.prank(client);
        usdc6.approve(address(escrow), type(uint256).max);
    }

    function _sortArbitrators() internal {
        address[3] memory arbs = [arb1, arb2, arb3];
        uint256[3] memory keys = [arbKey1, arbKey2, arbKey3];

        for (uint256 i = 0; i < 3; i++) {
            for (uint256 j = i + 1; j < 3; j++) {
                if (arbs[i] > arbs[j]) {
                    address tmpA = arbs[i];
                    arbs[i] = arbs[j];
                    arbs[j] = tmpA;

                    uint256 tmpK = keys[i];
                    keys[i] = keys[j];
                    keys[j] = tmpK;
                }
            }
        }
        arb1 = arbs[0];
        arb2 = arbs[1];
        arb3 = arbs[2];
        arbKey1 = keys[0];
        arbKey2 = keys[1];
        arbKey3 = keys[2];
    }

    function _createDefaultTerms(address asset, uint256 m1Amount, uint256 m2Amount) internal view returns (ILancechainEscrow.ProjectTerms memory) {
        ILancechainEscrow.MilestoneConfig[] memory m = new ILancechainEscrow.MilestoneConfig[](2);
        m[0] = ILancechainEscrow.MilestoneConfig({
            amount: m1Amount,
            deliveryDeadline: uint64(block.timestamp + 7 days),
            reviewPeriod: uint32(3 days),
            maxRevisions: 2
        });
        m[1] = ILancechainEscrow.MilestoneConfig({
            amount: m2Amount,
            deliveryDeadline: uint64(block.timestamp + 14 days),
            reviewPeriod: uint32(3 days),
            maxRevisions: 1
        });

        address[] memory committee = new address[](3);
        committee[0] = arb1;
        committee[1] = arb2;
        committee[2] = arb3;

        return ILancechainEscrow.ProjectTerms({
            client: client,
            freelancer: freelancer,
            token: asset,
            milestones: m,
            disputeWindow: uint32(5 days),
            committee: committee,
            quorumThreshold: 2,
            timeoutPolicy: ILancechainEscrow.TimeoutPolicy.SplitEvenly,
            feeBps: 250, // 2.5%
            feeRecipient: feeRecipient,
            agreementHash: AGREEMENT_HASH,
            nonce: 1,
            signatureExpiry: uint64(block.timestamp + 1 days)
        });
    }

    function _signTerms(ILancechainEscrow.ProjectTerms memory terms, uint256 privateKey) internal view returns (bytes memory) {
        bytes32 digest = escrow.hashTerms(terms);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signDisputeResolution(
        bytes32 projectId,
        uint256 milestoneIndex,
        uint32 disputeRound,
        uint16 clientSplitBps,
        uint16 freelancerSplitBps,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                escrow.DISPUTE_RESOLUTION_TYPEHASH(),
                projectId,
                milestoneIndex,
                disputeRound,
                clientSplitBps,
                freelancerSplitBps,
                disputeRound
            )
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(escrow.domainSeparator(), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _signMutualSettlement(
        bytes32 projectId,
        uint256 milestoneIndex,
        uint16 clientSplitBps,
        uint16 freelancerSplitBps,
        uint32 disputeRound,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(
            abi.encode(
                escrow.MUTUAL_SETTLEMENT_TYPEHASH(),
                projectId,
                milestoneIndex,
                clientSplitBps,
                freelancerSplitBps,
                disputeRound
            )
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(escrow.domainSeparator(), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    // --- TEST SUITES ---

    function test_CreateAndFundProject_NativeETH() public {
        ILancechainEscrow.ProjectTerms memory terms = _createDefaultTerms(address(0), 2 ether, 3 ether);
        bytes memory clientSig = _signTerms(terms, clientKey);
        bytes memory freelancerSig = _signTerms(terms, freelancerKey);

        vm.prank(client);
        bytes32 projectId = escrow.createAndFundProject{value: 5 ether}(terms, clientSig, freelancerSig);

        assertTrue(escrow.projectExists(projectId));
        (address c, address f, address tok,,,,,,,) = escrow.getProjectTerms(projectId);
        assertEq(c, client);
        assertEq(f, freelancer);
        assertEq(tok, address(0));

        (uint256 escrowLiab, uint256 creditLiab, uint256 totalLiab) = escrow.getLiabilities(address(0));
        assertEq(escrowLiab, 5 ether);
        assertEq(creditLiab, 0);
        assertEq(totalLiab, 5 ether);
        assertEq(address(escrow).balance, 5 ether);
    }

    function test_CreateAndFundProject_ERC20() public {
        ILancechainEscrow.ProjectTerms memory terms = _createDefaultTerms(address(usdc6), 1000 * 1e6, 1500 * 1e6);
        bytes memory clientSig = _signTerms(terms, clientKey);
        bytes memory freelancerSig = _signTerms(terms, freelancerKey);

        vm.prank(client);
        bytes32 projectId = escrow.createAndFundProject(terms, clientSig, freelancerSig);

        assertTrue(escrow.projectExists(projectId));
        (uint256 escrowLiab,, uint256 totalLiab) = escrow.getLiabilities(address(usdc6));
        assertEq(escrowLiab, 2500 * 1e6);
        assertEq(totalLiab, 2500 * 1e6);
        assertEq(usdc6.balanceOf(address(escrow)), 2500 * 1e6);
    }

    function test_EIP1271_ContractWalletSigner() public {
        MockERC1271Wallet wallet = new MockERC1271Wallet(client);
        vm.deal(address(wallet), 10 ether);

        ILancechainEscrow.ProjectTerms memory terms = _createDefaultTerms(address(0), 1 ether, 1 ether);
        terms.client = address(wallet);
        terms.nonce = 999;

        // Client signs on behalf of wallet
        bytes memory clientSig = _signTerms(terms, clientKey);
        bytes memory freelancerSig = _signTerms(terms, freelancerKey);

        vm.prank(address(wallet));
        bytes32 projectId = escrow.createAndFundProject{value: 2 ether}(terms, clientSig, freelancerSig);
        assertTrue(escrow.projectExists(projectId));
    }

    function test_FullHappyPath_MilestoneSettlementAndWithdrawal() public {
        ILancechainEscrow.ProjectTerms memory terms = _createDefaultTerms(address(0), 2 ether, 3 ether);
        bytes memory clientSig = _signTerms(terms, clientKey);
        bytes memory freelancerSig = _signTerms(terms, freelancerKey);

        vm.prank(client);
        bytes32 projectId = escrow.createAndFundProject{value: 5 ether}(terms, clientSig, freelancerSig);

        // Milestone 0: Submit deliverable
        vm.prank(freelancer);
        escrow.submitDeliverable(projectId, 0, DELIVERABLE_HASH);

        ILancechainEscrow.MilestoneData memory m0 = escrow.getMilestone(projectId, 0);
        assertEq(uint256(m0.state), uint256(ILancechainEscrow.MilestoneState.Submitted));
        assertEq(m0.deliverableHash, DELIVERABLE_HASH);

        // Client accepts milestone 0
        vm.prank(client);
        escrow.acceptMilestone(projectId, 0);

        m0 = escrow.getMilestone(projectId, 0);
        assertEq(uint256(m0.state), uint256(ILancechainEscrow.MilestoneState.Released));

        // Milestone 0 budget = 2 ether. Fee = 2.5% = 0.05 ether. Freelancer = 1.95 ether.
        uint256 expectedFee = (2 ether * 250) / 10000;
        uint256 expectedFreelancer = 2 ether - expectedFee;

        assertEq(escrow.getCredits(freelancer, address(0)), expectedFreelancer);
        assertEq(escrow.getCredits(feeRecipient, address(0)), expectedFee);

        // Milestone 1: Freelancer submits, review window expires, finalize
        vm.prank(freelancer);
        escrow.submitDeliverable(projectId, 1, DELIVERABLE_HASH);

        // Warp past review deadline
        ILancechainEscrow.MilestoneData memory m1 = escrow.getMilestone(projectId, 1);
        vm.warp(m1.reviewDeadline + 1);

        // Outsider calls finalize
        vm.prank(outsider);
        escrow.finalizeMilestone(projectId, 1);

        m1 = escrow.getMilestone(projectId, 1);
        assertEq(uint256(m1.state), uint256(ILancechainEscrow.MilestoneState.Released));
        assertTrue(escrow.isProjectSettled(projectId));

        // Pull withdrawals
        uint256 freeBalBefore = freelancer.balance;
        vm.prank(freelancer);
        uint256 withdrawn = escrow.withdraw(address(0), freelancer);
        assertEq(freelancer.balance - freeBalBefore, withdrawn);
        assertEq(escrow.getCredits(freelancer, address(0)), 0);

        // Invariant holds
        (uint256 eLiab, uint256 cLiab, uint256 tLiab) = escrow.getLiabilities(address(0));
        assertEq(eLiab, 0);
        assertEq(cLiab, expectedFee + (3 ether * 250 / 10000));
        assertEq(tLiab, address(escrow).balance);
    }

    function test_RevisionFlow_BoundedRevisions() public {
        ILancechainEscrow.ProjectTerms memory terms = _createDefaultTerms(address(0), 1 ether, 1 ether);
        bytes memory clientSig = _signTerms(terms, clientKey);
        bytes memory freelancerSig = _signTerms(terms, freelancerKey);

        vm.prank(client);
        bytes32 projectId = escrow.createAndFundProject{value: 2 ether}(terms, clientSig, freelancerSig);

        // Submit
        vm.prank(freelancer);
        escrow.submitDeliverable(projectId, 0, DELIVERABLE_HASH);

        // Request Revision 1
        bytes32 reason1 = keccak256("Fix UI alignment");
        vm.prank(client);
        escrow.requestRevision(projectId, 0, reason1, 2 days);

        ILancechainEscrow.MilestoneData memory m0 = escrow.getMilestone(projectId, 0);
        assertEq(uint256(m0.state), uint256(ILancechainEscrow.MilestoneState.RevisionRequested));
        assertEq(m0.revisionsUsed, 1);

        // Submit again
        vm.prank(freelancer);
        escrow.submitDeliverable(projectId, 0, keccak256("DELIVERABLE_V2"));

        // Request Revision 2 (maxRevisions = 2)
        bytes32 reason2 = keccak256("Fix mobile viewport");
        vm.prank(client);
        escrow.requestRevision(projectId, 0, reason2, 2 days);

        // Submit again
        vm.prank(freelancer);
        escrow.submitDeliverable(projectId, 0, keccak256("DELIVERABLE_V3"));

        // Attempting Revision 3 must revert (max exceeded)
        vm.prank(client);
        vm.expectRevert(LancechainEscrow.RevisionsExceeded.selector);
        escrow.requestRevision(projectId, 0, keccak256("Exceeds max"), 1 days);
    }

    function test_DeliveryDeadlineTimeout_RefundsRemainingPrincipal() public {
        ILancechainEscrow.ProjectTerms memory terms = _createDefaultTerms(address(0), 2 ether, 3 ether);
        bytes memory clientSig = _signTerms(terms, clientKey);
        bytes memory freelancerSig = _signTerms(terms, freelancerKey);

        vm.prank(client);
        bytes32 projectId = escrow.createAndFundProject{value: 5 ether}(terms, clientSig, freelancerSig);

        // Freelancer fails to submit milestone 0, deadline passes
        ILancechainEscrow.MilestoneData memory m0 = escrow.getMilestone(projectId, 0);
        vm.warp(m0.deliveryDeadline + 1);

        // Client claims delivery timeout refund
        vm.prank(client);
        escrow.claimDeliveryTimeout(projectId, 0);

        // Both milestone 0 and milestone 1 are refunded
        assertEq(uint256(escrow.getMilestone(projectId, 0).state), uint256(ILancechainEscrow.MilestoneState.Refunded));
        assertEq(uint256(escrow.getMilestone(projectId, 1).state), uint256(ILancechainEscrow.MilestoneState.Refunded));

        // Client credit = 5 ether
        assertEq(escrow.getCredits(client, address(0)), 5 ether);
        assertTrue(escrow.isProjectSettled(projectId));

        // Client withdraws
        uint256 balBefore = client.balance;
        vm.prank(client);
        escrow.withdraw(address(0), client);
        assertEq(client.balance - balBefore, 5 ether);
    }

    function test_DisputeQuorumResolution_TwoOfThreeArbitrators() public {
        ILancechainEscrow.ProjectTerms memory terms = _createDefaultTerms(address(0), 10 ether, 10 ether);
        bytes memory clientSig = _signTerms(terms, clientKey);
        bytes memory freelancerSig = _signTerms(terms, freelancerKey);

        vm.prank(client);
        bytes32 projectId = escrow.createAndFundProject{value: 20 ether}(terms, clientSig, freelancerSig);

        vm.prank(freelancer);
        escrow.submitDeliverable(projectId, 0, DELIVERABLE_HASH);

        // Client opens dispute
        vm.prank(client);
        escrow.openDispute(projectId, 0, keccak256("Disputed quality"));

        ILancechainEscrow.MilestoneData memory m0 = escrow.getMilestone(projectId, 0);
        assertEq(uint256(m0.state), uint256(ILancechainEscrow.MilestoneState.Disputed));

        // Arbitrators 1 and 2 sign a 60/40 split (60% to client, 40% to freelancer)
        bytes[] memory arbSigs = new bytes[](2);
        arbSigs[0] = _signDisputeResolution(projectId, 0, m0.disputeRound, 6000, 4000, arbKey1);
        arbSigs[1] = _signDisputeResolution(projectId, 0, m0.disputeRound, 6000, 4000, arbKey2);

        // Outsider submits valid resolution
        vm.prank(outsider);
        escrow.resolveDisputeWithQuorum(projectId, 0, 6000, 4000, arbSigs);

        m0 = escrow.getMilestone(projectId, 0);
        assertEq(uint256(m0.state), uint256(ILancechainEscrow.MilestoneState.SplitSettled));

        // Allocation checks:
        // Principal = 10 ether
        // Client = 60% = 6 ether
        // Freelancer gross = 4 ether. Fee (2.5%) = 0.1 ether. Freelancer net = 3.9 ether.
        assertEq(escrow.getCredits(client, address(0)), 6 ether);
        assertEq(escrow.getCredits(freelancer, address(0)), 3.9 ether);
        assertEq(escrow.getCredits(feeRecipient, address(0)), 0.1 ether);

        // Sum equals principal exactly: 6 + 3.9 + 0.1 = 10 ether
        assertEq(uint256(6 ether) + uint256(3.9 ether) + uint256(0.1 ether), 10 ether);
    }

    function test_DisputeTimeoutFallback_SplitEvenly() public {
        ILancechainEscrow.ProjectTerms memory terms = _createDefaultTerms(address(0), 10 ether, 10 ether);
        terms.timeoutPolicy = ILancechainEscrow.TimeoutPolicy.SplitEvenly;
        bytes memory clientSig = _signTerms(terms, clientKey);
        bytes memory freelancerSig = _signTerms(terms, freelancerKey);

        vm.prank(client);
        bytes32 projectId = escrow.createAndFundProject{value: 20 ether}(terms, clientSig, freelancerSig);

        vm.prank(freelancer);
        escrow.submitDeliverable(projectId, 0, DELIVERABLE_HASH);

        vm.prank(client);
        escrow.openDispute(projectId, 0, keccak256("Disputed specs"));

        ILancechainEscrow.MilestoneData memory m0 = escrow.getMilestone(projectId, 0);

        // Cannot call timeout before timeout expires
        vm.prank(outsider);
        vm.expectRevert(LancechainEscrow.DisputePeriodActive.selector);
        escrow.resolveDisputeTimeout(projectId, 0);

        // Warp past dispute timeout
        vm.warp(m0.disputeTimeout + 1);

        // Fallback resolves to 50/50
        vm.prank(outsider);
        escrow.resolveDisputeTimeout(projectId, 0);

        // Client receives 5 ether, Freelancer gross 5 ether minus 2.5% fee (0.125 ether) = 4.875 ether
        assertEq(escrow.getCredits(client, address(0)), 5 ether);
        assertEq(escrow.getCredits(freelancer, address(0)), 4.875 ether);
        assertEq(escrow.getCredits(feeRecipient, address(0)), 0.125 ether);
        assertEq(uint256(5 ether) + uint256(4.875 ether) + uint256(0.125 ether), 10 ether);
    }


    function test_MutualSettlement_CoSigned() public {
        ILancechainEscrow.ProjectTerms memory terms = _createDefaultTerms(address(0), 10 ether, 10 ether);
        bytes memory clientSig = _signTerms(terms, clientKey);
        bytes memory freelancerSig = _signTerms(terms, freelancerKey);

        vm.prank(client);
        bytes32 projectId = escrow.createAndFundProject{value: 20 ether}(terms, clientSig, freelancerSig);

        vm.prank(freelancer);
        escrow.submitDeliverable(projectId, 0, DELIVERABLE_HASH);

        // Both agree to 70/30 split
        bytes memory mutualClientSig = _signMutualSettlement(projectId, 0, 7000, 3000, 0, clientKey);
        bytes memory mutualFreelancerSig = _signMutualSettlement(projectId, 0, 7000, 3000, 0, freelancerKey);

        vm.prank(outsider);
        escrow.executeMutualSettlement(projectId, 0, 7000, 3000, mutualClientSig, mutualFreelancerSig);

        ILancechainEscrow.MilestoneData memory m0 = escrow.getMilestone(projectId, 0);
        assertEq(uint256(m0.state), uint256(ILancechainEscrow.MilestoneState.SplitSettled));
        assertEq(escrow.getCredits(client, address(0)), 7 ether);
        assertEq(escrow.getCredits(freelancer, address(0)), 3000 * 10 ether / 10000 - (3 ether * 250 / 10000));
    }

    function test_RevertingReceiver_WithdrawalFailedClaimPreserved() public {
        RevertingReceiver revReceiver = new RevertingReceiver();

        ILancechainEscrow.ProjectTerms memory terms = _createDefaultTerms(address(0), 1 ether, 1 ether);
        bytes memory clientSig = _signTerms(terms, clientKey);
        bytes memory freelancerSig = _signTerms(terms, freelancerKey);

        vm.prank(client);
        bytes32 projectId = escrow.createAndFundProject{value: 2 ether}(terms, clientSig, freelancerSig);

        vm.prank(freelancer);
        escrow.submitDeliverable(projectId, 0, DELIVERABLE_HASH);

        vm.prank(client);
        escrow.acceptMilestone(projectId, 0);

        uint256 fee = (1 ether * 250) / 10000;
        uint256 expectedCredit = 1 ether - fee;

        // Freelancer attempts to withdraw to reverting receiver
        vm.prank(freelancer);
        vm.expectRevert(LancechainEscrow.TransferFailed.selector);
        escrow.withdraw(address(0), address(revReceiver));

        // Credit remains safely claimable
        assertEq(escrow.getCredits(freelancer, address(0)), expectedCredit);

        // Freelancer withdraws to an EOA successfully
        vm.prank(freelancer);
        escrow.withdraw(address(0), freelancer);
        assertEq(escrow.getCredits(freelancer, address(0)), 0);
    }

    function test_ReputationOutcomeRecordedAndRatingFlow() public {
        ILancechainEscrow.ProjectTerms memory terms = _createDefaultTerms(address(0), 1 ether, 1 ether);
        bytes memory clientSig = _signTerms(terms, clientKey);
        bytes memory freelancerSig = _signTerms(terms, freelancerKey);

        vm.prank(client);
        bytes32 projectId = escrow.createAndFundProject{value: 2 ether}(terms, clientSig, freelancerSig);

        // Milestone 0
        vm.prank(freelancer);
        escrow.submitDeliverable(projectId, 0, DELIVERABLE_HASH);
        vm.prank(client);
        escrow.acceptMilestone(projectId, 0);

        // Milestone 1
        vm.prank(freelancer);
        escrow.submitDeliverable(projectId, 1, DELIVERABLE_HASH);
        vm.prank(client);
        escrow.acceptMilestone(projectId, 1);

        assertTrue(escrow.isProjectSettled(projectId));

        // Client rates freelancer 5 stars
        vm.prank(client);
        reputation.submitRating(projectId, freelancer, 5, keccak256("Outstanding work!"));

        // Freelancer rates client 5 stars
        vm.prank(freelancer);
        reputation.submitRating(projectId, client, 5, keccak256("Prompt review and clear requirements"));

        ILancechainReputation.ReputationScore memory fScore = reputation.getScore(freelancer);
        assertEq(fScore.completedCount, 2);
        assertEq(fScore.ratingCount, 1);
        assertEq(fScore.totalRatingStars, 5);

        // Duplicate rating rejected
        vm.prank(client);
        vm.expectRevert(LancechainReputation.AlreadyRated.selector);
        reputation.submitRating(projectId, freelancer, 4, keccak256("Again"));
    }
}
