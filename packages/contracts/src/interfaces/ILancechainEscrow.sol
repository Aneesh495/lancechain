// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

interface ILancechainEscrow {
    enum MilestoneState {
        Pending,
        Submitted,
        RevisionRequested,
        Disputed,
        Released,
        Refunded,
        SplitSettled
    }

    enum TimeoutPolicy {
        RefundToClient,
        ReleaseToFreelancer,
        SplitEvenly
    }

    struct MilestoneConfig {
        uint256 amount;
        uint64 deliveryDeadline;
        uint32 reviewPeriod;
        uint8 maxRevisions;
    }

    struct MilestoneData {
        MilestoneState state;
        uint256 amount;
        uint64 deliveryDeadline;
        uint64 reviewDeadline;
        uint64 disputeTimeout;
        uint32 reviewPeriod;
        uint8 maxRevisions;
        uint8 revisionsUsed;
        uint32 disputeRound;
        bytes32 deliverableHash;
        bytes32 revisionReasonHash;
        bytes32 disputeReasonHash;
    }

    struct ProjectTerms {
        address client;
        address freelancer;
        address token;
        MilestoneConfig[] milestones;
        uint32 disputeWindow;
        address[] committee;
        uint8 quorumThreshold;
        TimeoutPolicy timeoutPolicy;
        uint16 feeBps;
        address feeRecipient;
        bytes32 agreementHash;
        uint256 nonce;
        uint64 signatureExpiry;
    }

    event TermsAccepted(bytes32 indexed projectId, address indexed client, address indexed freelancer, address token, uint256 totalBudget);
    event ProjectFunded(bytes32 indexed projectId, address indexed funder, uint256 amount);
    event DeliverableSubmitted(bytes32 indexed projectId, uint256 indexed milestoneIndex, bytes32 deliverableHash, uint64 reviewDeadline);
    event RevisionRequested(bytes32 indexed projectId, uint256 indexed milestoneIndex, uint8 revisionNumber, bytes32 revisionReasonHash, uint64 newDeadline);
    event DisputeOpened(bytes32 indexed projectId, uint256 indexed milestoneIndex, address indexed initiator, bytes32 disputeReasonHash, uint64 disputeTimeout);
    event MilestoneSettled(
        bytes32 indexed projectId,
        uint256 indexed milestoneIndex,
        MilestoneState state,
        uint256 clientAmount,
        uint256 freelancerAmount,
        uint256 feeAmount
    );
    event MutualSettlementExecuted(bytes32 indexed projectId, uint256 indexed milestoneIndex, uint256 clientAmount, uint256 freelancerAmount, uint256 feeAmount);
    event CreditsWithdrawn(address indexed account, address indexed token, address indexed recipient, uint256 amount);
    event ProjectCompleted(bytes32 indexed projectId);

    function createAndFundProject(
        ProjectTerms calldata terms,
        bytes calldata clientSig,
        bytes calldata freelancerSig
    ) external payable returns (bytes32 projectId);

    function submitDeliverable(bytes32 projectId, uint256 milestoneIndex, bytes32 deliverableHash) external;
    function acceptMilestone(bytes32 projectId, uint256 milestoneIndex) external;
    function requestRevision(bytes32 projectId, uint256 milestoneIndex, bytes32 revisionReasonHash, uint64 extensionSeconds) external;
    function finalizeMilestone(bytes32 projectId, uint256 milestoneIndex) external;
    function claimDeliveryTimeout(bytes32 projectId, uint256 milestoneIndex) external;
    function openDispute(bytes32 projectId, uint256 milestoneIndex, bytes32 disputeReasonHash) external;
    function resolveDisputeWithQuorum(
        bytes32 projectId,
        uint256 milestoneIndex,
        uint16 clientSplitBps,
        uint16 freelancerSplitBps,
        bytes[] calldata arbitratorSignatures
    ) external;
    function resolveDisputeTimeout(bytes32 projectId, uint256 milestoneIndex) external;
    function executeMutualSettlement(
        bytes32 projectId,
        uint256 milestoneIndex,
        uint16 clientSplitBps,
        uint16 freelancerSplitBps,
        bytes calldata clientSig,
        bytes calldata freelancerSig
    ) external;
    function withdraw(address token, address recipient) external returns (uint256 amount);

    function getProjectTerms(bytes32 projectId) external view returns (
        address client,
        address freelancer,
        address token,
        uint32 disputeWindow,
        uint8 quorumThreshold,
        TimeoutPolicy timeoutPolicy,
        uint16 feeBps,
        address feeRecipient,
        bytes32 agreementHash,
        uint256 milestoneCount
    );

    function getMilestone(bytes32 projectId, uint256 milestoneIndex) external view returns (MilestoneData memory);
    function getCredits(address account, address token) external view returns (uint256);
    function getLiabilities(address token) external view returns (uint256 escrowLiability, uint256 creditLiability, uint256 totalLiability);
    function isProjectSettled(bytes32 projectId) external view returns (bool);
}
