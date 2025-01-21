// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {ILancechainReputation} from "./interfaces/ILancechainReputation.sol";
import {ILancechainEscrow} from "./interfaces/ILancechainEscrow.sol";

contract LancechainReputation is ILancechainReputation {
    address public immutable escrow;

    mapping(address => ReputationScore) private _scores;
    mapping(bytes32 => mapping(address => bool)) public hasRated;
    mapping(bytes32 => RatingRecord[]) private _projectRatings;

    error OnlyEscrow();
    error ProjectNotSettled();
    error NotCounterparty();
    error AlreadyRated();
    error InvalidScore();
    error ZeroAddress();

    modifier onlyEscrow() {
        if (msg.sender != escrow) revert OnlyEscrow();
        _;
    }

    constructor(address escrowAddress) {
        if (escrowAddress == address(0)) revert ZeroAddress();
        escrow = escrowAddress;
    }

    function recordOutcome(
        bytes32 projectId,
        address counterparty,
        Outcome outcome
    ) external override onlyEscrow {
        if (counterparty == address(0)) revert ZeroAddress();
        ReputationScore storage score = _scores[counterparty];
        score.totalProjects++;

        if (outcome == Outcome.CompletedOnTime || outcome == Outcome.RevisionCompleted) {
            score.completedCount++;
        } else if (outcome == Outcome.DisputedResolved) {
            score.disputedCount++;
        } else if (outcome == Outcome.DisputeTimeoutFallback || outcome == Outcome.DeliveryTimeoutRefund) {
            score.timeoutCount++;
            if (outcome == Outcome.DeliveryTimeoutRefund) {
                score.refundCount++;
            }
        } else if (outcome == Outcome.MutualCancellation) {
            score.refundCount++;
        }

        emit OutcomeLogged(projectId, counterparty, outcome);
    }

    function submitRating(
        bytes32 projectId,
        address ratee,
        uint8 score,
        bytes32 feedbackHash
    ) external override {
        if (score < 1 || score > 5) revert InvalidScore();
        if (ratee == address(0) || ratee == msg.sender) revert ZeroAddress();

        if (!ILancechainEscrow(escrow).isProjectSettled(projectId)) {
            revert ProjectNotSettled();
        }

        (address client, address freelancer,,,,,,,,) = ILancechainEscrow(escrow).getProjectTerms(projectId);

        bool isClient = (msg.sender == client && ratee == freelancer);
        bool isFreelancer = (msg.sender == freelancer && ratee == client);
        if (!isClient && !isFreelancer) revert NotCounterparty();

        if (hasRated[projectId][msg.sender]) revert AlreadyRated();
        hasRated[projectId][msg.sender] = true;

        ReputationScore storage rep = _scores[ratee];
        rep.ratingCount++;
        rep.totalRatingStars += score;

        RatingRecord memory rec = RatingRecord({
            projectId: projectId,
            rater: msg.sender,
            ratee: ratee,
            score: score,
            feedbackHash: feedbackHash,
            timestamp: uint64(block.timestamp)
        });
        _projectRatings[projectId].push(rec);

        emit RatingSubmitted(projectId, msg.sender, ratee, score, feedbackHash);
    }

    function getScore(address account) external view override returns (ReputationScore memory) {
        return _scores[account];
    }

    function getProjectRatings(bytes32 projectId) external view returns (RatingRecord[] memory) {
        return _projectRatings[projectId];
    }
}
