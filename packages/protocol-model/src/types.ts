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

export interface MilestoneConfig {
  amount: bigint;
  deliveryDeadline: bigint;
  reviewPeriod: number;
  maxRevisions: number;
}

export interface MilestoneData {
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

export interface ProjectModel {
  id: string;
  terms: ProjectTerms;
  totalBudget: bigint;
  activeMilestoneIndex: number;
  milestones: MilestoneData[];
  settled: boolean;
}

export interface LiabilityModel {
  escrowLiability: bigint;
  creditLiability: bigint;
  totalLiability: bigint;
}

export interface ModelEvent {
  name: string;
  projectId: string;
  milestoneIndex?: number;
  data: Record<string, unknown>;
  timestamp: bigint;
}
