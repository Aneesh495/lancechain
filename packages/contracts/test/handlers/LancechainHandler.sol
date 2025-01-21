// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {Test, console} from "forge-std/Test.sol";
import {LancechainEscrow} from "../../src/LancechainEscrow.sol";
import {LancechainReputation} from "../../src/LancechainReputation.sol";
import {ILancechainEscrow} from "../../src/interfaces/ILancechainEscrow.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract LancechainHandler is Test {
    LancechainEscrow public immutable escrow;
    LancechainReputation public immutable reputation;
    MockERC20 public immutable token18;
    MockERC20 public immutable usdc6;

    uint256 internal clientKey = 0xAA11;
    uint256 internal freelancerKey = 0xBB22;
    uint256 internal feeRecipientKey = 0xFF33;
    uint256 internal arbKey1 = 0x111;
    uint256 internal arbKey2 = 0x222;
    uint256 internal arbKey3 = 0x333;

    address public client;
    address public freelancer;
    address public feeRecipient;
    address public arb1;
    address public arb2;
    address public arb3;

    bytes32[] public activeProjectIds;
    address[] public supportedTokens;
    address[] public actors;

    // Ghost variables for accounting and invariant tracking
    uint256 public successfulTransitions;
    uint256 public attemptCount;
    uint256 public revertCount;

    uint256 public ghost_projectsCreated;
    uint256 public ghost_deliverablesSubmitted;
    uint256 public ghost_milestonesAccepted;
    uint256 public ghost_milestonesFinalized;
    uint256 public ghost_revisionsRequested;
    uint256 public ghost_deliveryTimeoutsClaimed;
    uint256 public ghost_disputesOpened;
    uint256 public ghost_quorumResolutions;
    uint256 public ghost_disputeTimeouts;
    uint256 public ghost_mutualSettlements;
    uint256 public ghost_withdrawals;

    mapping(address => mapping(address => uint256)) public ghost_userCredits;
    mapping(address => uint256) public ghost_totalCredited;
    mapping(address => uint256) public ghost_totalWithdrawn;

    uint256 private _nonceCounter = 1;

    constructor(
        LancechainEscrow _escrow,
        LancechainReputation _reputation,
        MockERC20 _token18,
        MockERC20 _usdc6
    ) {
        escrow = _escrow;
        reputation = _reputation;
        token18 = _token18;
        usdc6 = _usdc6;

        client = vm.addr(clientKey);
        freelancer = vm.addr(freelancerKey);
        feeRecipient = vm.addr(feeRecipientKey);
        arb1 = vm.addr(arbKey1);
        arb2 = vm.addr(arbKey2);
        arb3 = vm.addr(arbKey3);

        _sortArbitrators();

        vm.deal(client, 10_000_000 ether);
        vm.deal(freelancer, 1000 ether);
        vm.deal(feeRecipient, 1000 ether);

        token18.mint(client, 100_000_000 ether);
        usdc6.mint(client, 100_000_000 * 1e6);

        vm.prank(client);
        token18.approve(address(escrow), type(uint256).max);
        vm.prank(client);
        usdc6.approve(address(escrow), type(uint256).max);

        supportedTokens.push(address(0));
        supportedTokens.push(address(token18));
        supportedTokens.push(address(usdc6));

        actors.push(client);
        actors.push(freelancer);
        actors.push(feeRecipient);
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

    function createProject(uint256 tokenIndexSeed, uint256 m1AmountSeed, uint256 m2AmountSeed, uint16 feeBpsSeed) external {
        attemptCount++;
        address token = supportedTokens[tokenIndexSeed % supportedTokens.length];

        uint256 m1 = (m1AmountSeed % 1000 + 1) * (token == address(usdc6) ? 1e6 : 1 ether);
        uint256 m2 = (m2AmountSeed % 1000 + 1) * (token == address(usdc6) ? 1e6 : 1 ether);
        uint16 feeBps = uint16(feeBpsSeed % 500); // 0 to 5%

        ILancechainEscrow.MilestoneConfig[] memory m = new ILancechainEscrow.MilestoneConfig[](2);
        m[0] = ILancechainEscrow.MilestoneConfig({
            amount: m1,
            deliveryDeadline: uint64(block.timestamp + 3 days),
            reviewPeriod: uint32(2 days),
            maxRevisions: 2
        });
        m[1] = ILancechainEscrow.MilestoneConfig({
            amount: m2,
            deliveryDeadline: uint64(block.timestamp + 6 days),
            reviewPeriod: uint32(2 days),
            maxRevisions: 2
        });

        address[] memory committee = new address[](3);
        committee[0] = arb1;
        committee[1] = arb2;
        committee[2] = arb3;

        uint256 nonce = _nonceCounter++;
        ILancechainEscrow.ProjectTerms memory terms = ILancechainEscrow.ProjectTerms({
            client: client,
            freelancer: freelancer,
            token: token,
            milestones: m,
            disputeWindow: uint32(3 days),
            committee: committee,
            quorumThreshold: 2,
            timeoutPolicy: ILancechainEscrow.TimeoutPolicy.SplitEvenly,
            feeBps: feeBps,
            feeRecipient: feeRecipient,
            agreementHash: keccak256(abi.encode("SOW", nonce)),
            nonce: nonce,
            signatureExpiry: uint64(block.timestamp + 1 days)
        });

        bytes32 digest = escrow.hashTerms(terms);
        (uint8 vC, bytes32 rC, bytes32 sC) = vm.sign(clientKey, digest);
        bytes memory clientSig = abi.encodePacked(rC, sC, vC);

        (uint8 vF, bytes32 rF, bytes32 sF) = vm.sign(freelancerKey, digest);
        bytes memory freelancerSig = abi.encodePacked(rF, sF, vF);

        uint256 total = m1 + m2;
        vm.prank(client);
        try escrow.createAndFundProject{value: token == address(0) ? total : 0}(terms, clientSig, freelancerSig) returns (bytes32 pId) {
            activeProjectIds.push(pId);
            successfulTransitions++;
            ghost_projectsCreated++;
        } catch {
            revertCount++;
        }
    }

    function submitDeliverable(uint256 projIndexSeed, bytes32 deliverableSeed) external {
        attemptCount++;
        if (activeProjectIds.length == 0) {
            revertCount++;
            return;
        }
        bytes32 pId = activeProjectIds[projIndexSeed % activeProjectIds.length];
        if (deliverableSeed == bytes32(0)) deliverableSeed = keccak256("DELIV");

        try escrow.getMilestone(pId, 0) returns (ILancechainEscrow.MilestoneData memory m0) {
            uint256 targetIdx = (m0.state == ILancechainEscrow.MilestoneState.Submitted ||
                                m0.state == ILancechainEscrow.MilestoneState.Released ||
                                m0.state == ILancechainEscrow.MilestoneState.Refunded ||
                                m0.state == ILancechainEscrow.MilestoneState.SplitSettled) ? 1 : 0;

            vm.prank(freelancer);
            try escrow.submitDeliverable(pId, targetIdx, deliverableSeed) {
                successfulTransitions++;
                ghost_deliverablesSubmitted++;
            } catch {
                revertCount++;
            }
        } catch {
            revertCount++;
        }
    }

    function acceptMilestone(uint256 projIndexSeed) external {
        attemptCount++;
        if (activeProjectIds.length == 0) {
            revertCount++;
            return;
        }
        bytes32 pId = activeProjectIds[projIndexSeed % activeProjectIds.length];

        try escrow.getMilestone(pId, 0) returns (ILancechainEscrow.MilestoneData memory m0) {
            uint256 targetIdx = (m0.state == ILancechainEscrow.MilestoneState.Released ||
                                m0.state == ILancechainEscrow.MilestoneState.Refunded ||
                                m0.state == ILancechainEscrow.MilestoneState.SplitSettled) ? 1 : 0;

            vm.prank(client);
            try escrow.acceptMilestone(pId, targetIdx) {
                successfulTransitions++;
                ghost_milestonesAccepted++;
            } catch {
                revertCount++;
            }
        } catch {
            revertCount++;
        }
    }

    function requestRevision(uint256 projIndexSeed, bytes32 reasonSeed, uint64 extension) external {
        attemptCount++;
        if (activeProjectIds.length == 0) {
            revertCount++;
            return;
        }
        bytes32 pId = activeProjectIds[projIndexSeed % activeProjectIds.length];
        if (reasonSeed == bytes32(0)) reasonSeed = keccak256("REVISION");
        if (extension == 0) extension = 1 days;

        try escrow.getMilestone(pId, 0) returns (ILancechainEscrow.MilestoneData memory m0) {
            uint256 targetIdx = (m0.state == ILancechainEscrow.MilestoneState.Released ||
                                m0.state == ILancechainEscrow.MilestoneState.Refunded ||
                                m0.state == ILancechainEscrow.MilestoneState.SplitSettled) ? 1 : 0;

            vm.prank(client);
            try escrow.requestRevision(pId, targetIdx, reasonSeed, extension) {
                successfulTransitions++;
                ghost_revisionsRequested++;
            } catch {
                revertCount++;
            }
        } catch {
            revertCount++;
        }
    }

    function finalizeMilestone(uint256 projIndexSeed) external {
        attemptCount++;
        if (activeProjectIds.length == 0) {
            revertCount++;
            return;
        }
        bytes32 pId = activeProjectIds[projIndexSeed % activeProjectIds.length];

        try escrow.getMilestone(pId, 0) returns (ILancechainEscrow.MilestoneData memory m0) {
            uint256 targetIdx = (m0.state == ILancechainEscrow.MilestoneState.Released ||
                                m0.state == ILancechainEscrow.MilestoneState.Refunded ||
                                m0.state == ILancechainEscrow.MilestoneState.SplitSettled) ? 1 : 0;

            ILancechainEscrow.MilestoneData memory mTarget = escrow.getMilestone(pId, targetIdx);
            if (mTarget.reviewDeadline > 0 && block.timestamp <= mTarget.reviewDeadline) {
                vm.warp(mTarget.reviewDeadline + 1);
            }

            try escrow.finalizeMilestone(pId, targetIdx) {
                successfulTransitions++;
                ghost_milestonesFinalized++;
            } catch {
                revertCount++;
            }
        } catch {
            revertCount++;
        }
    }

    function claimDeliveryTimeout(uint256 projIndexSeed) external {
        attemptCount++;
        if (activeProjectIds.length == 0) {
            revertCount++;
            return;
        }
        bytes32 pId = activeProjectIds[projIndexSeed % activeProjectIds.length];

        try escrow.getMilestone(pId, 0) returns (ILancechainEscrow.MilestoneData memory m0) {
            uint256 targetIdx = (m0.state == ILancechainEscrow.MilestoneState.Released ||
                                m0.state == ILancechainEscrow.MilestoneState.Refunded ||
                                m0.state == ILancechainEscrow.MilestoneState.SplitSettled) ? 1 : 0;

            ILancechainEscrow.MilestoneData memory mTarget = escrow.getMilestone(pId, targetIdx);
            if (block.timestamp <= mTarget.deliveryDeadline) {
                vm.warp(mTarget.deliveryDeadline + 1);
            }

            vm.prank(client);
            try escrow.claimDeliveryTimeout(pId, targetIdx) {
                successfulTransitions++;
                ghost_deliveryTimeoutsClaimed++;
            } catch {
                revertCount++;
            }
        } catch {
            revertCount++;
        }
    }

    function openDispute(uint256 projIndexSeed, bytes32 reasonSeed) external {
        attemptCount++;
        if (activeProjectIds.length == 0) {
            revertCount++;
            return;
        }
        bytes32 pId = activeProjectIds[projIndexSeed % activeProjectIds.length];
        if (reasonSeed == bytes32(0)) reasonSeed = keccak256("DISPUTE");

        try escrow.getMilestone(pId, 0) returns (ILancechainEscrow.MilestoneData memory m0) {
            uint256 targetIdx = (m0.state == ILancechainEscrow.MilestoneState.Released ||
                                m0.state == ILancechainEscrow.MilestoneState.Refunded ||
                                m0.state == ILancechainEscrow.MilestoneState.SplitSettled) ? 1 : 0;

            vm.prank(client);
            try escrow.openDispute(pId, targetIdx, reasonSeed) {
                successfulTransitions++;
                ghost_disputesOpened++;
            } catch {
                revertCount++;
            }
        } catch {
            revertCount++;
        }
    }

    function resolveDisputeQuorum(uint256 projIndexSeed, uint16 clientBpsSeed) external {
        attemptCount++;
        if (activeProjectIds.length == 0) {
            revertCount++;
            return;
        }
        bytes32 pId = activeProjectIds[projIndexSeed % activeProjectIds.length];

        uint16 clientBps = uint16(clientBpsSeed % 10001);
        uint16 freelancerBps = uint16(10000 - clientBps);

        try escrow.getMilestone(pId, 0) returns (ILancechainEscrow.MilestoneData memory m0) {
            uint256 targetIdx = (m0.state == ILancechainEscrow.MilestoneState.Released ||
                                m0.state == ILancechainEscrow.MilestoneState.Refunded ||
                                m0.state == ILancechainEscrow.MilestoneState.SplitSettled) ? 1 : 0;

            ILancechainEscrow.MilestoneData memory mTarget = escrow.getMilestone(pId, targetIdx);
            if (mTarget.state != ILancechainEscrow.MilestoneState.Disputed) {
                revertCount++;
                return;
            }

            bytes32 structHash = keccak256(
                abi.encode(
                    escrow.DISPUTE_RESOLUTION_TYPEHASH(),
                    pId,
                    targetIdx,
                    mTarget.disputeRound,
                    clientBps,
                    freelancerBps,
                    mTarget.disputeRound
                )
            );
            bytes32 digest = MessageHashUtils.toTypedDataHash(escrow.domainSeparator(), structHash);

            bytes[] memory sigs = new bytes[](2);
            (uint8 v1, bytes32 r1, bytes32 s1) = vm.sign(arbKey1, digest);
            (uint8 v2, bytes32 r2, bytes32 s2) = vm.sign(arbKey2, digest);
            sigs[0] = abi.encodePacked(r1, s1, v1);
            sigs[1] = abi.encodePacked(r2, s2, v2);

            try escrow.resolveDisputeWithQuorum(pId, targetIdx, clientBps, freelancerBps, sigs) {
                successfulTransitions++;
                ghost_quorumResolutions++;
            } catch {
                revertCount++;
            }
        } catch {
            revertCount++;
        }
    }

    function resolveDisputeTimeout(uint256 projIndexSeed) external {
        attemptCount++;
        if (activeProjectIds.length == 0) {
            revertCount++;
            return;
        }
        bytes32 pId = activeProjectIds[projIndexSeed % activeProjectIds.length];

        try escrow.getMilestone(pId, 0) returns (ILancechainEscrow.MilestoneData memory m0) {
            uint256 targetIdx = (m0.state == ILancechainEscrow.MilestoneState.Released ||
                                m0.state == ILancechainEscrow.MilestoneState.Refunded ||
                                m0.state == ILancechainEscrow.MilestoneState.SplitSettled) ? 1 : 0;

            ILancechainEscrow.MilestoneData memory mTarget = escrow.getMilestone(pId, targetIdx);
            if (mTarget.state == ILancechainEscrow.MilestoneState.Disputed && block.timestamp <= mTarget.disputeTimeout) {
                vm.warp(mTarget.disputeTimeout + 1);
            }

            try escrow.resolveDisputeTimeout(pId, targetIdx) {
                successfulTransitions++;
                ghost_disputeTimeouts++;
            } catch {
                revertCount++;
            }
        } catch {
            revertCount++;
        }
    }

    function executeMutualSettlement(uint256 projIndexSeed, uint16 clientBpsSeed) external {
        attemptCount++;
        if (activeProjectIds.length == 0) {
            revertCount++;
            return;
        }
        bytes32 pId = activeProjectIds[projIndexSeed % activeProjectIds.length];

        uint16 clientBps = uint16(clientBpsSeed % 10001);
        uint16 freelancerBps = uint16(10000 - clientBps);

        try escrow.getMilestone(pId, 0) returns (ILancechainEscrow.MilestoneData memory m0) {
            uint256 targetIdx = (m0.state == ILancechainEscrow.MilestoneState.Released ||
                                m0.state == ILancechainEscrow.MilestoneState.Refunded ||
                                m0.state == ILancechainEscrow.MilestoneState.SplitSettled) ? 1 : 0;

            ILancechainEscrow.MilestoneData memory mTarget = escrow.getMilestone(pId, targetIdx);

            bytes32 structHash = keccak256(
                abi.encode(
                    escrow.MUTUAL_SETTLEMENT_TYPEHASH(),
                    pId,
                    targetIdx,
                    clientBps,
                    freelancerBps,
                    mTarget.disputeRound
                )
            );
            bytes32 digest = MessageHashUtils.toTypedDataHash(escrow.domainSeparator(), structHash);

            (uint8 vC, bytes32 rC, bytes32 sC) = vm.sign(clientKey, digest);
            (uint8 vF, bytes32 rF, bytes32 sF) = vm.sign(freelancerKey, digest);

            bytes memory cSig = abi.encodePacked(rC, sC, vC);
            bytes memory fSig = abi.encodePacked(rF, sF, vF);

            try escrow.executeMutualSettlement(pId, targetIdx, clientBps, freelancerBps, cSig, fSig) {
                successfulTransitions++;
                ghost_mutualSettlements++;
            } catch {
                revertCount++;
            }
        } catch {
            revertCount++;
        }
    }

    function withdraw(uint256 actorSeed, uint256 tokenSeed) external {
        attemptCount++;
        address actor = actors[actorSeed % actors.length];
        address token = supportedTokens[tokenSeed % supportedTokens.length];

        uint256 credit = escrow.getCredits(actor, token);
        if (credit == 0) {
            revertCount++;
            return;
        }

        vm.prank(actor);
        try escrow.withdraw(token, actor) returns (uint256 amount) {
            successfulTransitions++;
            ghost_withdrawals++;
            ghost_totalWithdrawn[token] += amount;
        } catch {
            revertCount++;
        }
    }

    function forceSurplus(uint256 tokenSeed, uint256 amountSeed) external {
        attemptCount++;
        address token = supportedTokens[tokenSeed % supportedTokens.length];
        uint256 amount = (amountSeed % 100 + 1) * (token == address(usdc6) ? 1e6 : 1 ether);

        if (token == address(0)) {
            vm.deal(address(escrow), address(escrow).balance + amount);
        } else {
            MockERC20(token).mint(address(escrow), amount);
        }
        successfulTransitions++;
    }

    function warpTime(uint256 secondsSeed) external {
        attemptCount++;
        uint256 secs = (secondsSeed % 7 days) + 1 hours;
        vm.warp(block.timestamp + secs);
        successfulTransitions++;
    }
}
