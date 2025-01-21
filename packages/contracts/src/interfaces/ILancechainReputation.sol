// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

interface ILancechainReputation {
    enum Outcome {
        CompletedOnTime,
        RevisionCompleted,
        DisputedResolved,
        DisputeTimeoutFallback,
        DeliveryTimeoutRefund,
        MutualCancellation
    }

    struct ReputationScore {
        uint32 totalProjects;
        uint32 completedCount;
        uint32 disputedCount;
        uint32 timeoutCount;
        uint32 refundCount;
        uint32 ratingCount;
        uint64 totalRatingStars;
    }

    struct RatingRecord {
        bytes32 projectId;
        address rater;
        address ratee;
        uint8 score;
        bytes32 feedbackHash;
        uint64 timestamp;
    }

    event OutcomeLogged(bytes32 indexed projectId, address indexed counterparty, Outcome outcome);
    event RatingSubmitted(bytes32 indexed projectId, address indexed rater, address indexed ratee, uint8 score, bytes32 feedbackHash);

    function recordOutcome(bytes32 projectId, address counterparty, Outcome outcome) external;
    function submitRating(bytes32 projectId, address ratee, uint8 score, bytes32 feedbackHash) external;
    function getScore(address account) external view returns (ReputationScore memory);
}
