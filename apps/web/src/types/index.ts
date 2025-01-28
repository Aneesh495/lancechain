/**
 * Core domain types and enumerations for Lancechain Web Application.
 */

export enum MilestoneStatus {
  NONE = 0,
  DRAFT = 1,
  FUNDED = 2,
  SUBMITTED = 3,
  APPROVED = 4,
  DISPUTED = 5,
  RESOLVED = 6,
  REFUNDED = 7,
  CANCELLED = 8,
}

export enum AgreementStatus {
  NONE = 0,
  DRAFT = 1,
  SIGNED = 2,
  ACTIVE = 3,
  COMPLETED = 4,
  DISPUTED = 5,
  CANCELLED = 6,
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

export interface MilestoneTerms {
  milestoneId: number;
  description: string;
  amount: string; // in wei or base units
  deadline: number; // unix timestamp in seconds
  deliverableHash: string; // bytes32 hex
}

export interface AgreementTerms {
  agreementId: string;
  client: string;
  freelancer: string;
  arbitrator: string;
  token: string;
  milestones: MilestoneTerms[];
  arbitrationFeeBps: number;
  termsUri: string;
  salt: string;
}

export interface DeliverableSubmissionData {
  agreementId: string;
  milestoneId: number;
  title: string;
  description: string;
  repositoryCommitUrl?: string;
  demoUrl?: string;
  artifactHash: string;
  submittedAt: number;
  submittedBy: string;
}

export interface DisputeRecord {
  disputeId: string;
  agreementId: string;
  milestoneId: number;
  initiator: string;
  reason: string;
  claimCategory: 'non_delivery' | 'quality_defect' | 'scope_mismatch' | 'unresponsive' | 'other';
  evidenceUri: string;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED';
  createdAt: number;
  clientAward: string;
  freelancerAward: string;
  arbitratorNotes?: string;
}

export interface MilestoneRecord {
  milestoneId: number;
  agreementId: string;
  description: string;
  amount: string;
  deadline: number;
  status: MilestoneStatus;
  deliverableHash?: string;
  submissionTime?: number;
  deliverable?: DeliverableSubmissionData;
  dispute?: DisputeRecord;
  fundedAt?: number;
  approvedAt?: number;
  resolvedAt?: number;
}

export interface AgreementRecord {
  agreementId: string;
  client: string;
  freelancer: string;
  arbitrator: string;
  token: string;
  tokenSymbol: string;
  tokenDecimals: number;
  status: AgreementStatus;
  totalCommitted: string;
  totalFunded: string;
  totalPaidOut: string;
  totalDisputed: string;
  termsHash: string;
  termsUri: string;
  arbitrationFeeBps: number;
  clientSignature?: string;
  freelancerSignature?: string;
  milestones: MilestoneRecord[];
  createdAt: number;
  updatedAt: number;
}

export interface ReputationProfile {
  address: string;
  score: number;
  tier: 'Unrated' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  totalProjectsCompleted: number;
  totalVolumeHandled: string;
  totalDisputesInvolved: number;
  disputesWon: number;
  disputesLost: number;
  disputeRateBps: number;
  averageCompletionTimeSeconds: number;
  history: Array<{
    agreementId: string;
    action: string;
    delta: number;
    timestamp: number;
    details: string;
  }>;
}

export interface WithdrawalBalance {
  token: string;
  tokenSymbol: string;
  tokenDecimals: number;
  availableAmount: string;
  withdrawnAmount: string;
}

export interface AuditEvent {
  id: string;
  blockNumber: number;
  blockHash: string;
  transactionHash: string;
  logIndex: number;
  eventName: string;
  agreementId?: string;
  milestoneId?: number;
  actor: string;
  amount?: string;
  timestamp: number;
  data: Record<string, unknown>;
  reorged?: boolean;
}

export interface FinancialLiabilities {
  tokenAddress: string;
  tokenSymbol: string;
  contractBalance: string;
  activeEscrowLiabilities: string;
  unclaimedWithdrawalBalances: string;
  accumulatedProtocolFees: string;
  totalContractObligations: string;
  surplusOrDeficit: string;
  invariantSatisfied: boolean;
}

export interface ReconciliationReport {
  timestamp: string;
  contractAddress: string;
  tokensAudited: FinancialLiabilities[];
  allInvariantsPassed: boolean;
  blockNumber: number;
  checks: {
    exactSumConservation: boolean;
    pullLedgerSolvency: boolean;
    reorgConsistency: boolean;
    unclaimedBalanceSafety: boolean;
  };
}

export interface WalletAccount {
  address: string;
  label: string;
  role: 'client' | 'freelancer' | 'arbitrator' | 'admin' | 'observer';
  privateKey?: string;
  balanceEth: string;
}
