export enum MilestoneState {
  Pending = 0,
  Submitted = 1,
  RevisionRequested = 2,
  Disputed = 3,
  Released = 4,
  Refunded = 5,
  SplitSettled = 6,
}

export enum TimeoutPolicy {
  RefundToClient = 0,
  ReleaseToFreelancer = 1,
  SplitEvenly = 2,
}

export enum ReputationOutcome {
  CompletedOnTime = 0,
  RevisionCompleted = 1,
  DisputedResolved = 2,
  DisputeTimeoutFallback = 3,
  DeliveryTimeoutRefund = 4,
  MutualCancellation = 5,
}

export enum TransactionStage {
  SignatureRequested = "signature_requested",
  Submitted = "submitted",
  Mined = "mined",
  Confirmed = "confirmed",
  Failed = "failed",
}

export interface MilestoneConfig {
  amount: bigint;
  deliveryDeadline: bigint;
  reviewPeriod: number;
  maxRevisions: number;
}

export interface MilestoneData {
  index: number;
  state: MilestoneState;
  amount: bigint;
  deliveryDeadline: bigint;
  reviewDeadline: bigint;
  disputeTimeout: bigint;
  reviewPeriod: number;
  maxRevisions: number;
  revisionsUsed: number;
  disputeRound: number;
  deliverableHash: string;
  revisionReasonHash: string;
  disputeReasonHash: string;
}

export interface ProjectTerms {
  client: string;
  freelancer: string;
  token: string;
  milestones: MilestoneConfig[];
  disputeWindow: number;
  committee: string[];
  quorumThreshold: number;
  timeoutPolicy: TimeoutPolicy;
  feeBps: number;
  feeRecipient: string;
  agreementHash: string;
  nonce: bigint;
  signatureExpiry: bigint;
}

export interface ProjectView {
  id: string;
  client: string;
  freelancer: string;
  token: string;
  disputeWindow: number;
  quorumThreshold: number;
  timeoutPolicy: TimeoutPolicy;
  feeBps: number;
  feeRecipient: string;
  agreementHash: string;
  milestoneCount: number;
  isSettled: boolean;
  milestones: MilestoneData[];
}

export interface LiabilityView {
  token: string;
  escrowLiability: bigint;
  creditLiability: bigint;
  totalLiability: bigint;
}

export interface ReputationScore {
  totalProjects: number;
  completedCount: number;
  disputedCount: number;
  timeoutCount: number;
  refundCount: number;
  ratingCount: number;
  totalRatingStars: bigint;
  averageRating: number;
}

export interface RatingRecord {
  projectId: string;
  rater: string;
  ratee: string;
  score: number;
  feedbackHash: string;
  timestamp: bigint;
}

export interface DeploymentManifest {
  chainId: number;
  chainName: string;
  escrowAddress: string;
  reputationAddress: string;
  escrowBytecodeHash: string;
  reputationBytecodeHash: string;
  deployedBlock: number;
  deployedTxHash: string;
  compiler: {
    solcVersion: string;
    optimizer: boolean;
    optimizerRuns: number;
    evmVersion: string;
    viaIR: boolean;
  };
}

export interface TransactionProgress {
  stage: TransactionStage;
  txHash?: string;
  blockNumber?: number;
  confirmations?: number;
  error?: Error;
}
