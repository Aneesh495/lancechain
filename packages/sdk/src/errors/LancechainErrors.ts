import { ethers } from "ethers";
import { LancechainEscrowAbi } from "../abi/LancechainEscrowAbi.js";
import { LancechainReputationAbi } from "../abi/LancechainReputationAbi.js";

export class LancechainError extends Error {
  public readonly code: string;
  public readonly data?: unknown;

  constructor(code: string, message: string, data?: unknown) {
    super(`LancechainProtocolError[${code}]: ${message}`);
    this.name = "LancechainError";
    this.code = code;
    this.data = data;
  }
}

const ERROR_DESCRIPTIONS: Record<string, string> = {
  ZeroAddress: "Zero address cannot be used for participant, token, or deliverable.",
  InvalidCounterparty: "Client and Freelancer cannot be the same address.",
  InvalidMilestoneCount: "Milestone count must be between 1 and 32.",
  InvalidDeadlines: "Milestone deadlines must be in the future and chronologically ordered.",
  InvalidCommittee: "Dispute committee must contain between 1 and 7 distinct non-counterparty addresses.",
  InvalidQuorumThreshold: "Quorum threshold must be greater than zero and <= committee size.",
  InvalidFee: "Platform fee cannot exceed 1000 basis points (10%).",
  TermsExpired: "Project terms have passed their signature expiration timestamp.",
  NonceAlreadyUsed: "The nonce specified in project terms has already been consumed.",
  InvalidSignature: "EIP-712 or EIP-1271 signature verification failed.",
  InsufficientFunding: "Supplied native value or approved token amount does not cover total budget.",
  BalanceMismatch: "Net received token balance differs from the specified milestone principal.",
  ProjectNotFound: "The requested project ID does not exist on this escrow contract.",
  MilestoneNotFound: "Milestone index is out of bounds for this project.",
  InvalidState: "Operation not permitted in current milestone lifecycle state.",
  Unauthorized: "Caller is not authorized to perform this action.",
  ReviewPeriodNotExpired: "Review window has not yet elapsed for automatic finalization.",
  DeliveryDeadlineNotPassed: "Delivery deadline has not yet passed for timeout claim.",
  DisputePeriodExpired: "Dispute can only be raised during the active review window.",
  DisputePeriodActive: "Dispute resolution timeout cannot be claimed while window is active.",
  QuorumNotMet: "Insufficient number of authorized committee signatures provided.",
  InvalidSigner: "Signer is not an authorized member of the project's frozen committee.",
  DuplicateSigner: "Duplicate signatures detected from the same committee member.",
  InvalidSplitBps: "Client and freelancer split basis points must sum exactly to 10000 (100%).",
  ZeroCredit: "No withdrawable credits available for this account and asset.",
  TransferFailed: "Direct transfer or call to recipient failed.",
  RevisionsExceeded: "Maximum allowed revision requests exceeded for this milestone.",
  ProjectNotSettled: "Reputation rating requires the project to be fully settled first.",
  NotCounterparty: "Only counterparties of settled projects can submit reputation ratings.",
  AlreadyRated: "Counterparty has already submitted a rating for this project.",
  InvalidScore: "Rating score must be an integer between 1 and 5 stars.",
};

export function parseContractError(err: unknown): LancechainError {
  if (err instanceof LancechainError) return err;

  const errObj = err as { data?: string; error?: { data?: string }; message?: string };
  const rawData = errObj?.data || errObj?.error?.data;

  if (rawData && typeof rawData === "string" && rawData.startsWith("0x")) {
    const selector = rawData.slice(0, 10).toLowerCase();

    // Check against escrow errors
    const escrowIface = new ethers.Interface(LancechainEscrowAbi as unknown as ethers.InterfaceAbi);
    for (const frag of escrowIface.fragments) {
      if (frag.type === "error") {
        const errorFrag = frag as ethers.ErrorFragment;
        if (escrowIface.getFunction(errorFrag.name) === null) {
          const expectedSel = ethers.id(errorFrag.format()).slice(0, 10).toLowerCase();
          if (expectedSel === selector) {
            const desc = ERROR_DESCRIPTIONS[errorFrag.name] ?? "Custom contract error encountered.";
            return new LancechainError(errorFrag.name, desc, rawData);
          }
        }
      }
    }

    // Check against reputation errors
    const repIface = new ethers.Interface(LancechainReputationAbi as unknown as ethers.InterfaceAbi);
    for (const frag of repIface.fragments) {
      if (frag.type === "error") {
        const errorFrag = frag as ethers.ErrorFragment;
        const expectedSel = ethers.id(errorFrag.format()).slice(0, 10).toLowerCase();
        if (expectedSel === selector) {
          const desc = ERROR_DESCRIPTIONS[errorFrag.name] ?? "Custom reputation error encountered.";
          return new LancechainError(errorFrag.name, desc, rawData);
        }
      }
    }
  }

  const message = errObj?.message || String(err);
  for (const [name, desc] of Object.entries(ERROR_DESCRIPTIONS)) {
    if (message.includes(name)) {
      return new LancechainError(name, desc);
    }
  }

  return new LancechainError("UNKNOWN_ERROR", message, err);
}
