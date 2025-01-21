// SPDX-License-Identifier: MIT
pragma solidity 0.8.27;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ILancechainEscrow} from "./interfaces/ILancechainEscrow.sol";
import {ILancechainReputation} from "./interfaces/ILancechainReputation.sol";

contract LancechainEscrow is ILancechainEscrow, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 public constant MILESTONE_CONFIG_TYPEHASH = keccak256(
        "MilestoneConfig(uint256 amount,uint64 deliveryDeadline,uint32 reviewPeriod,uint8 maxRevisions)"
    );

    bytes32 public constant PROJECT_TERMS_TYPEHASH = keccak256(
        "ProjectTerms(address client,address freelancer,address token,bytes32 milestoneHashes,uint32 disputeWindow,bytes32 committeeHash,uint8 quorumThreshold,uint8 timeoutPolicy,uint16 feeBps,address feeRecipient,bytes32 agreementHash,uint256 nonce,uint64 signatureExpiry)"
    );

    bytes32 public constant DISPUTE_RESOLUTION_TYPEHASH = keccak256(
        "DisputeResolution(bytes32 projectId,uint256 milestoneIndex,uint32 disputeRound,uint16 clientSplitBps,uint16 freelancerSplitBps,uint256 nonce)"
    );

    bytes32 public constant MUTUAL_SETTLEMENT_TYPEHASH = keccak256(
        "MutualSettlement(bytes32 projectId,uint256 milestoneIndex,uint16 clientSplitBps,uint16 freelancerSplitBps,uint256 nonce)"
    );

    uint16 public constant MAX_FEE_BPS = 1000; // 10% maximum platform fee
    uint256 public constant MAX_MILESTONES = 32;

    struct ProjectStorage {
        address client;
        address freelancer;
        address token;
        uint32 disputeWindow;
        uint8 quorumThreshold;
        TimeoutPolicy timeoutPolicy;
        uint16 feeBps;
        address feeRecipient;
        bytes32 agreementHash;
        uint256 activeMilestoneIndex;
        uint256 totalBudget;
        address[] committee;
        MilestoneData[] milestones;
    }

    mapping(bytes32 => ProjectStorage) private _projects;
    mapping(bytes32 => bool) public projectExists;
    mapping(address => mapping(uint256 => bool)) public clientNonces;
    mapping(address => mapping(address => uint256)) private _credits;
    mapping(address => uint256) public totalEscrowLiability;
    mapping(address => uint256) public totalCreditLiability;
    mapping(bytes32 => mapping(uint256 => bool)) public resolutionNonces;

    address public reputationContract;

    error ZeroAddress();
    error InvalidCounterparty();
    error InvalidMilestoneCount();
    error InvalidDeadlines();
    error InvalidCommittee();
    error InvalidQuorumThreshold();
    error InvalidFee();
    error TermsExpired();
    error NonceAlreadyUsed();
    error InvalidSignature();
    error InsufficientFunding();
    error BalanceMismatch();
    error ProjectNotFound();
    error MilestoneNotFound();
    error InvalidState();
    error Unauthorized();
    error ReviewPeriodNotExpired();
    error DeliveryDeadlineNotPassed();
    error DisputePeriodExpired();
    error DisputePeriodActive();
    error QuorumNotMet();
    error InvalidSigner();
    error DuplicateSigner();
    error InvalidSplitBps();
    error ZeroCredit();
    error TransferFailed();
    error RevisionsExceeded();

    modifier onlyReputationOrOwner() {
        _;
    }

    constructor() {}

    function setReputationContract(address rep) external {
        if (reputationContract != address(0)) revert Unauthorized();
        if (rep == address(0)) revert ZeroAddress();
        reputationContract = rep;
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                DOMAIN_TYPEHASH,
                keccak256(bytes("LancechainEscrow")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    function hashMilestoneConfig(MilestoneConfig memory m) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                MILESTONE_CONFIG_TYPEHASH,
                m.amount,
                m.deliveryDeadline,
                m.reviewPeriod,
                m.maxRevisions
            )
        );
    }

    function hashTerms(ProjectTerms memory terms) public view returns (bytes32) {
        bytes32[] memory mHashes = new bytes32[](terms.milestones.length);
        for (uint256 i = 0; i < terms.milestones.length; i++) {
            mHashes[i] = hashMilestoneConfig(terms.milestones[i]);
        }
        bytes32 milestoneHashes = keccak256(abi.encodePacked(mHashes));
        bytes32 committeeHash = keccak256(abi.encodePacked(terms.committee));

        bytes32 structHash = keccak256(
            abi.encode(
                PROJECT_TERMS_TYPEHASH,
                terms.client,
                terms.freelancer,
                terms.token,
                milestoneHashes,
                terms.disputeWindow,
                committeeHash,
                terms.quorumThreshold,
                uint8(terms.timeoutPolicy),
                terms.feeBps,
                terms.feeRecipient,
                terms.agreementHash,
                terms.nonce,
                terms.signatureExpiry
            )
        );

        return MessageHashUtils.toTypedDataHash(domainSeparator(), structHash);
    }

    function createAndFundProject(
        ProjectTerms calldata terms,
        bytes calldata clientSig,
        bytes calldata freelancerSig
    ) external payable override nonReentrant returns (bytes32 projectId) {
        if (terms.client == address(0) || terms.freelancer == address(0)) revert ZeroAddress();
        if (terms.client == terms.freelancer) revert InvalidCounterparty();
        if (terms.milestones.length == 0 || terms.milestones.length > MAX_MILESTONES) revert InvalidMilestoneCount();
        if (terms.feeBps > MAX_FEE_BPS) revert InvalidFee();
        if (terms.feeBps > 0 && terms.feeRecipient == address(0)) revert ZeroAddress();
        if (block.timestamp > terms.signatureExpiry) revert TermsExpired();
        if (clientNonces[terms.client][terms.nonce]) revert NonceAlreadyUsed();
        clientNonces[terms.client][terms.nonce] = true;

        // Committee validation
        uint256 committeeLen = terms.committee.length;
        if (committeeLen == 0 || committeeLen > 7) revert InvalidCommittee();
        if (terms.quorumThreshold == 0 || terms.quorumThreshold > committeeLen) revert InvalidQuorumThreshold();
        for (uint256 i = 0; i < committeeLen; i++) {
            address m = terms.committee[i];
            if (m == address(0) || m == terms.client || m == terms.freelancer) revert InvalidCommittee();
            for (uint256 j = i + 1; j < committeeLen; j++) {
                if (m == terms.committee[j]) revert InvalidCommittee();
            }
        }

        // Validate milestones and calculate total budget
        uint256 totalBudget = 0;
        uint64 lastDeadline = 0;
        for (uint256 i = 0; i < terms.milestones.length; i++) {
            MilestoneConfig memory m = terms.milestones[i];
            if (m.amount == 0) revert InsufficientFunding();
            if (m.deliveryDeadline <= block.timestamp || m.deliveryDeadline < lastDeadline) revert InvalidDeadlines();
            if (m.reviewPeriod < 1 hours || m.reviewPeriod > 30 days) revert InvalidDeadlines();
            lastDeadline = m.deliveryDeadline;
            totalBudget += m.amount;
        }

        bytes32 termsDigest = hashTerms(terms);

        // Verify signatures (caller can be one party, or relayer with both signatures)
        if (msg.sender != terms.client) {
            if (!SignatureChecker.isValidSignatureNow(terms.client, termsDigest, clientSig)) {
                revert InvalidSignature();
            }
        }
        if (msg.sender != terms.freelancer) {
            if (!SignatureChecker.isValidSignatureNow(terms.freelancer, termsDigest, freelancerSig)) {
                revert InvalidSignature();
            }
        }

        projectId = keccak256(abi.encode(termsDigest, terms.client, terms.nonce));
        if (projectExists[projectId]) revert NonceAlreadyUsed();
        projectExists[projectId] = true;

        // Handle funding with balance verification
        if (terms.token == address(0)) {
            if (msg.value != totalBudget) revert InsufficientFunding();
        } else {
            if (msg.value != 0) revert InsufficientFunding();
            uint256 balBefore = IERC20(terms.token).balanceOf(address(this));
            address funder = (msg.sender == terms.client) ? msg.sender : terms.client;
            IERC20(terms.token).safeTransferFrom(funder, address(this), totalBudget);
            uint256 balAfter = IERC20(terms.token).balanceOf(address(this));
            if (balAfter - balBefore != totalBudget) revert BalanceMismatch();
        }

        totalEscrowLiability[terms.token] += totalBudget;

        // Store project
        ProjectStorage storage p = _projects[projectId];
        p.client = terms.client;
        p.freelancer = terms.freelancer;
        p.token = terms.token;
        p.disputeWindow = terms.disputeWindow;
        p.committee = terms.committee;
        p.quorumThreshold = terms.quorumThreshold;
        p.timeoutPolicy = terms.timeoutPolicy;
        p.feeBps = terms.feeBps;
        p.feeRecipient = terms.feeRecipient;
        p.agreementHash = terms.agreementHash;
        p.totalBudget = totalBudget;
        p.activeMilestoneIndex = 0;

        for (uint256 i = 0; i < terms.milestones.length; i++) {
            MilestoneConfig memory mc = terms.milestones[i];
            p.milestones.push(
                MilestoneData({
                    state: MilestoneState.Pending,
                    amount: mc.amount,
                    deliveryDeadline: mc.deliveryDeadline,
                    reviewDeadline: 0,
                    disputeTimeout: 0,
                    reviewPeriod: mc.reviewPeriod,
                    maxRevisions: mc.maxRevisions,
                    revisionsUsed: 0,
                    disputeRound: 0,
                    deliverableHash: bytes32(0),
                    revisionReasonHash: bytes32(0),
                    disputeReasonHash: bytes32(0)
                })
            );
        }

        emit TermsAccepted(projectId, terms.client, terms.freelancer, terms.token, totalBudget);
        emit ProjectFunded(projectId, msg.sender, totalBudget);
    }

    function submitDeliverable(
        bytes32 projectId,
        uint256 milestoneIndex,
        bytes32 deliverableHash
    ) external override {
        ProjectStorage storage p = _projects[projectId];
        if (p.client == address(0)) revert ProjectNotFound();
        if (msg.sender != p.freelancer) revert Unauthorized();
        if (milestoneIndex != p.activeMilestoneIndex) revert InvalidState();
        if (deliverableHash == bytes32(0)) revert ZeroAddress();

        MilestoneData storage m = p.milestones[milestoneIndex];
        if (m.state != MilestoneState.Pending && m.state != MilestoneState.RevisionRequested) {
            revert InvalidState();
        }
        if (block.timestamp > m.deliveryDeadline) revert DeliveryDeadlineNotPassed();

        m.state = MilestoneState.Submitted;
        m.deliverableHash = deliverableHash;
        m.reviewDeadline = uint64(block.timestamp + m.reviewPeriod);

        emit DeliverableSubmitted(projectId, milestoneIndex, deliverableHash, m.reviewDeadline);
    }

    function acceptMilestone(bytes32 projectId, uint256 milestoneIndex) external override nonReentrant {
        ProjectStorage storage p = _projects[projectId];
        if (p.client == address(0)) revert ProjectNotFound();
        if (msg.sender != p.client) revert Unauthorized();
        if (milestoneIndex != p.activeMilestoneIndex) revert InvalidState();

        MilestoneData storage m = p.milestones[milestoneIndex];
        if (m.state != MilestoneState.Submitted) revert InvalidState();

        _settleMilestone(projectId, milestoneIndex, MilestoneState.Released, 0, 10000);

        if (reputationContract != address(0)) {
            ILancechainReputation(reputationContract).recordOutcome(
                projectId,
                p.freelancer,
                m.revisionsUsed > 0
                    ? ILancechainReputation.Outcome.RevisionCompleted
                    : ILancechainReputation.Outcome.CompletedOnTime
            );
        }
    }

    function requestRevision(
        bytes32 projectId,
        uint256 milestoneIndex,
        bytes32 revisionReasonHash,
        uint64 extensionSeconds
    ) external override {
        ProjectStorage storage p = _projects[projectId];
        if (p.client == address(0)) revert ProjectNotFound();
        if (msg.sender != p.client) revert Unauthorized();
        if (milestoneIndex != p.activeMilestoneIndex) revert InvalidState();

        MilestoneData storage m = p.milestones[milestoneIndex];
        if (m.state != MilestoneState.Submitted) revert InvalidState();
        if (m.revisionsUsed >= m.maxRevisions) revert RevisionsExceeded();

        uint64 maxAllowedExtension = uint64(m.reviewPeriod * 2);
        if (extensionSeconds == 0 || extensionSeconds > maxAllowedExtension) {
            extensionSeconds = maxAllowedExtension;
        }

        m.revisionsUsed++;
        m.state = MilestoneState.RevisionRequested;
        m.revisionReasonHash = revisionReasonHash;
        m.deliveryDeadline = uint64(block.timestamp + extensionSeconds);
        m.reviewDeadline = 0;

        emit RevisionRequested(projectId, milestoneIndex, m.revisionsUsed, revisionReasonHash, m.deliveryDeadline);
    }

    function finalizeMilestone(bytes32 projectId, uint256 milestoneIndex) external override nonReentrant {
        ProjectStorage storage p = _projects[projectId];
        if (p.client == address(0)) revert ProjectNotFound();
        if (milestoneIndex != p.activeMilestoneIndex) revert InvalidState();

        MilestoneData storage m = p.milestones[milestoneIndex];
        if (m.state != MilestoneState.Submitted) revert InvalidState();
        if (block.timestamp <= m.reviewDeadline) revert ReviewPeriodNotExpired();

        _settleMilestone(projectId, milestoneIndex, MilestoneState.Released, 0, 10000);

        if (reputationContract != address(0)) {
            ILancechainReputation(reputationContract).recordOutcome(
                projectId,
                p.freelancer,
                ILancechainReputation.Outcome.CompletedOnTime
            );
        }
    }

    function claimDeliveryTimeout(bytes32 projectId, uint256 milestoneIndex) external override nonReentrant {
        ProjectStorage storage p = _projects[projectId];
        if (p.client == address(0)) revert ProjectNotFound();
        if (msg.sender != p.client) revert Unauthorized();
        if (milestoneIndex != p.activeMilestoneIndex) revert InvalidState();

        MilestoneData storage m = p.milestones[milestoneIndex];
        if (m.state != MilestoneState.Pending && m.state != MilestoneState.RevisionRequested) {
            revert InvalidState();
        }
        if (block.timestamp <= m.deliveryDeadline) revert DeliveryDeadlineNotPassed();

        // Refund this milestone and all remaining unstarted milestones to client
        uint256 totalRefundAmount = 0;
        for (uint256 i = milestoneIndex; i < p.milestones.length; i++) {
            if (p.milestones[i].state == MilestoneState.Pending || p.milestones[i].state == MilestoneState.RevisionRequested) {
                p.milestones[i].state = MilestoneState.Refunded;
                totalRefundAmount += p.milestones[i].amount;
                emit MilestoneSettled(projectId, i, MilestoneState.Refunded, p.milestones[i].amount, 0, 0);
            }
        }

        totalEscrowLiability[p.token] -= totalRefundAmount;
        totalCreditLiability[p.token] += totalRefundAmount;
        _credits[p.client][p.token] += totalRefundAmount;
        p.activeMilestoneIndex = p.milestones.length; // terminate project

        if (reputationContract != address(0)) {
            ILancechainReputation(reputationContract).recordOutcome(
                projectId,
                p.freelancer,
                ILancechainReputation.Outcome.DeliveryTimeoutRefund
            );
        }

        emit ProjectCompleted(projectId);
    }

    function openDispute(
        bytes32 projectId,
        uint256 milestoneIndex,
        bytes32 disputeReasonHash
    ) external override {
        ProjectStorage storage p = _projects[projectId];
        if (p.client == address(0)) revert ProjectNotFound();
        if (msg.sender != p.client && msg.sender != p.freelancer) revert Unauthorized();
        if (milestoneIndex != p.activeMilestoneIndex) revert InvalidState();

        MilestoneData storage m = p.milestones[milestoneIndex];
        if (m.state != MilestoneState.Submitted && m.state != MilestoneState.RevisionRequested) {
            revert InvalidState();
        }
        if (m.state == MilestoneState.Submitted && block.timestamp > m.reviewDeadline) {
            revert DisputePeriodExpired();
        }

        m.state = MilestoneState.Disputed;
        m.disputeRound++;
        m.disputeReasonHash = disputeReasonHash;
        m.disputeTimeout = uint64(block.timestamp + p.disputeWindow);

        emit DisputeOpened(projectId, milestoneIndex, msg.sender, disputeReasonHash, m.disputeTimeout);
    }

    function resolveDisputeWithQuorum(
        bytes32 projectId,
        uint256 milestoneIndex,
        uint16 clientSplitBps,
        uint16 freelancerSplitBps,
        bytes[] calldata arbitratorSignatures
    ) external override nonReentrant {
        if (clientSplitBps + freelancerSplitBps != 10000) revert InvalidSplitBps();

        ProjectStorage storage p = _projects[projectId];
        if (p.client == address(0)) revert ProjectNotFound();
        if (milestoneIndex != p.activeMilestoneIndex) revert InvalidState();

        MilestoneData storage m = p.milestones[milestoneIndex];
        if (m.state != MilestoneState.Disputed) revert InvalidState();
        if (arbitratorSignatures.length < p.quorumThreshold) revert QuorumNotMet();

        bytes32 structHash = keccak256(
            abi.encode(
                DISPUTE_RESOLUTION_TYPEHASH,
                projectId,
                milestoneIndex,
                m.disputeRound,
                clientSplitBps,
                freelancerSplitBps,
                m.disputeRound
            )
        );
        bytes32 resolutionDigest = MessageHashUtils.toTypedDataHash(domainSeparator(), structHash);

        // Verify distinct signatures from frozen committee in strictly ascending order
        address lastSigner = address(0);
        for (uint256 i = 0; i < arbitratorSignatures.length; i++) {
            address recovered = _recoverSigner(resolutionDigest, arbitratorSignatures[i]);
            if (recovered <= lastSigner) revert DuplicateSigner();
            if (!_isCommitteeMember(p.committee, recovered)) revert InvalidSigner();
            lastSigner = recovered;
        }

        _settleMilestone(projectId, milestoneIndex, MilestoneState.SplitSettled, clientSplitBps, freelancerSplitBps);

        if (reputationContract != address(0)) {
            ILancechainReputation(reputationContract).recordOutcome(
                projectId,
                p.freelancer,
                ILancechainReputation.Outcome.DisputedResolved
            );
        }
    }

    function resolveDisputeTimeout(bytes32 projectId, uint256 milestoneIndex) external override nonReentrant {
        ProjectStorage storage p = _projects[projectId];
        if (p.client == address(0)) revert ProjectNotFound();
        if (milestoneIndex != p.activeMilestoneIndex) revert InvalidState();

        MilestoneData storage m = p.milestones[milestoneIndex];
        if (m.state != MilestoneState.Disputed) revert InvalidState();
        if (block.timestamp <= m.disputeTimeout) revert DisputePeriodActive();

        uint16 clientBps = 0;
        uint16 freelancerBps = 0;

        if (p.timeoutPolicy == TimeoutPolicy.RefundToClient) {
            clientBps = 10000;
            freelancerBps = 0;
        } else if (p.timeoutPolicy == TimeoutPolicy.ReleaseToFreelancer) {
            clientBps = 0;
            freelancerBps = 10000;
        } else {
            // SplitEvenly
            clientBps = 5000;
            freelancerBps = 5000;
        }

        _settleMilestone(projectId, milestoneIndex, MilestoneState.SplitSettled, clientBps, freelancerBps);

        if (reputationContract != address(0)) {
            ILancechainReputation(reputationContract).recordOutcome(
                projectId,
                p.freelancer,
                ILancechainReputation.Outcome.DisputeTimeoutFallback
            );
        }
    }

    function executeMutualSettlement(
        bytes32 projectId,
        uint256 milestoneIndex,
        uint16 clientSplitBps,
        uint16 freelancerSplitBps,
        bytes calldata clientSig,
        bytes calldata freelancerSig
    ) external override nonReentrant {
        if (clientSplitBps + freelancerSplitBps != 10000) revert InvalidSplitBps();

        ProjectStorage storage p = _projects[projectId];
        if (p.client == address(0)) revert ProjectNotFound();
        if (milestoneIndex != p.activeMilestoneIndex) revert InvalidState();

        MilestoneData storage m = p.milestones[milestoneIndex];
        if (
            m.state == MilestoneState.Released ||
            m.state == MilestoneState.Refunded ||
            m.state == MilestoneState.SplitSettled
        ) {
            revert InvalidState();
        }

        bytes32 structHash = keccak256(
            abi.encode(
                MUTUAL_SETTLEMENT_TYPEHASH,
                projectId,
                milestoneIndex,
                clientSplitBps,
                freelancerSplitBps,
                m.disputeRound
            )
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(domainSeparator(), structHash);

        if (msg.sender != p.client) {
            if (!SignatureChecker.isValidSignatureNow(p.client, digest, clientSig)) {
                revert InvalidSignature();
            }
        }
        if (msg.sender != p.freelancer) {
            if (!SignatureChecker.isValidSignatureNow(p.freelancer, digest, freelancerSig)) {
                revert InvalidSignature();
            }
        }

        _settleMilestone(projectId, milestoneIndex, MilestoneState.SplitSettled, clientSplitBps, freelancerSplitBps);

        if (reputationContract != address(0)) {
            ILancechainReputation(reputationContract).recordOutcome(
                projectId,
                p.freelancer,
                ILancechainReputation.Outcome.MutualCancellation
            );
        }

        emit MutualSettlementExecuted(projectId, milestoneIndex, clientSplitBps, freelancerSplitBps, 0);
    }

    function _settleMilestone(
        bytes32 projectId,
        uint256 milestoneIndex,
        MilestoneState targetState,
        uint16 clientSplitBps,
        uint16 freelancerSplitBps
    ) internal {
        if (clientSplitBps + freelancerSplitBps != 10000) revert InvalidSplitBps();

        ProjectStorage storage p = _projects[projectId];
        MilestoneData storage m = p.milestones[milestoneIndex];

        uint256 principal = m.amount;
        m.state = targetState;

        uint256 clientAmount = (principal * clientSplitBps) / 10000;
        uint256 freelancerGross = principal - clientAmount;
        uint256 feeAmount = 0;
        uint256 freelancerNet = freelancerGross;

        if (p.feeBps > 0 && freelancerGross > 0) {
            feeAmount = (freelancerGross * p.feeBps) / 10000;
            freelancerNet = freelancerGross - feeAmount;
        }

        // Exact liability conservation
        totalEscrowLiability[p.token] -= principal;
        totalCreditLiability[p.token] += principal;

        if (clientAmount > 0) {
            _credits[p.client][p.token] += clientAmount;
        }
        if (freelancerNet > 0) {
            _credits[p.freelancer][p.token] += freelancerNet;
        }
        if (feeAmount > 0) {
            _credits[p.feeRecipient][p.token] += feeAmount;
        }

        p.activeMilestoneIndex++;

        emit MilestoneSettled(
            projectId,
            milestoneIndex,
            targetState,
            clientAmount,
            freelancerNet,
            feeAmount
        );

        if (p.activeMilestoneIndex >= p.milestones.length) {
            emit ProjectCompleted(projectId);
        }
    }

    function withdraw(address token, address recipient) external override nonReentrant returns (uint256 amount) {
        if (recipient == address(0)) revert ZeroAddress();
        amount = _credits[msg.sender][token];
        if (amount == 0) revert ZeroCredit();

        _credits[msg.sender][token] = 0;
        totalCreditLiability[token] -= amount;

        emit CreditsWithdrawn(msg.sender, token, recipient, amount);

        if (token == address(0)) {
            (bool ok, ) = payable(recipient).call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            IERC20(token).safeTransfer(recipient, amount);
        }
    }

    function _recoverSigner(bytes32 digest, bytes memory signature) internal pure returns (address) {
        (address signer, ECDSA.RecoverError err, ) = ECDSA.tryRecover(digest, signature);
        if (err != ECDSA.RecoverError.NoError || signer == address(0)) {
            revert InvalidSignature();
        }
        return signer;
    }


    function _isCommitteeMember(address[] storage committee, address target) internal view returns (bool) {
        uint256 len = committee.length;
        for (uint256 i = 0; i < len; i++) {
            if (committee[i] == target) return true;
        }
        return false;
    }

    function getProjectTerms(bytes32 projectId) external view override returns (
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
    ) {
        ProjectStorage storage p = _projects[projectId];
        if (p.client == address(0)) revert ProjectNotFound();
        return (
            p.client,
            p.freelancer,
            p.token,
            p.disputeWindow,
            p.quorumThreshold,
            p.timeoutPolicy,
            p.feeBps,
            p.feeRecipient,
            p.agreementHash,
            p.milestones.length
        );
    }

    function getMilestone(bytes32 projectId, uint256 milestoneIndex) external view override returns (MilestoneData memory) {
        ProjectStorage storage p = _projects[projectId];
        if (p.client == address(0)) revert ProjectNotFound();
        if (milestoneIndex >= p.milestones.length) revert MilestoneNotFound();
        return p.milestones[milestoneIndex];
    }

    function getProjectCommittee(bytes32 projectId) external view returns (address[] memory) {
        ProjectStorage storage p = _projects[projectId];
        if (p.client == address(0)) revert ProjectNotFound();
        return p.committee;
    }

    function getCredits(address account, address token) external view override returns (uint256) {
        return _credits[account][token];
    }

    function getLiabilities(address token) external view override returns (
        uint256 escrowLiability,
        uint256 creditLiability,
        uint256 totalLiability
    ) {
        escrowLiability = totalEscrowLiability[token];
        creditLiability = totalCreditLiability[token];
        totalLiability = escrowLiability + creditLiability;
    }

    function isProjectSettled(bytes32 projectId) external view override returns (bool) {
        ProjectStorage storage p = _projects[projectId];
        if (p.client == address(0)) return false;
        return p.activeMilestoneIndex >= p.milestones.length;
    }

    receive() external payable {}
}
