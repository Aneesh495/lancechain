import { ethers } from "ethers";
import { LancechainEscrowAbi } from "../abi/LancechainEscrowAbi.js";
import { LancechainReputationAbi } from "../abi/LancechainReputationAbi.js";
import { MilestoneState } from "../types.js";

export interface DecodedTermsAccepted {
  name: "TermsAccepted";
  projectId: string;
  client: string;
  freelancer: string;
  token: string;
  totalBudget: bigint;
}

export interface DecodedProjectFunded {
  name: "ProjectFunded";
  projectId: string;
  funder: string;
  amount: bigint;
}

export interface DecodedDeliverableSubmitted {
  name: "DeliverableSubmitted";
  projectId: string;
  milestoneIndex: number;
  deliverableHash: string;
  reviewDeadline: bigint;
}

export interface DecodedRevisionRequested {
  name: "RevisionRequested";
  projectId: string;
  milestoneIndex: number;
  revisionNumber: number;
  revisionReasonHash: string;
  newDeadline: bigint;
}

export interface DecodedDisputeOpened {
  name: "DisputeOpened";
  projectId: string;
  milestoneIndex: number;
  initiator: string;
  disputeReasonHash: string;
  disputeTimeout: bigint;
}

export interface DecodedMilestoneSettled {
  name: "MilestoneSettled";
  projectId: string;
  milestoneIndex: number;
  state: MilestoneState;
  clientAmount: bigint;
  freelancerAmount: bigint;
  feeAmount: bigint;
}

export interface DecodedCreditsWithdrawn {
  name: "CreditsWithdrawn";
  account: string;
  token: string;
  recipient: string;
  amount: bigint;
}

export interface DecodedProjectCompleted {
  name: "ProjectCompleted";
  projectId: string;
}

export type DecodedLancechainEvent =
  | DecodedTermsAccepted
  | DecodedProjectFunded
  | DecodedDeliverableSubmitted
  | DecodedRevisionRequested
  | DecodedDisputeOpened
  | DecodedMilestoneSettled
  | DecodedCreditsWithdrawn
  | DecodedProjectCompleted;

export class EventDecoder {
  private escrowInterface: ethers.Interface;
  private repInterface: ethers.Interface;

  constructor() {
    this.escrowInterface = new ethers.Interface(LancechainEscrowAbi as unknown as ethers.InterfaceAbi);
    this.repInterface = new ethers.Interface(LancechainReputationAbi as unknown as ethers.InterfaceAbi);
  }

  public decodeReceiptEvents(receipt: ethers.ContractTransactionReceipt): DecodedLancechainEvent[] {
    const results: DecodedLancechainEvent[] = [];

    for (const log of receipt.logs) {
      try {
        const parsed = this.escrowInterface.parseLog({
          topics: log.topics as string[],
          data: log.data,
        });
        if (!parsed) continue;

        switch (parsed.name) {
          case "TermsAccepted":
            results.push({
              name: "TermsAccepted",
              projectId: parsed.args[0],
              client: parsed.args[1],
              freelancer: parsed.args[2],
              token: parsed.args[3],
              totalBudget: parsed.args[4],
            });
            break;
          case "ProjectFunded":
            results.push({
              name: "ProjectFunded",
              projectId: parsed.args[0],
              funder: parsed.args[1],
              amount: parsed.args[2],
            });
            break;
          case "DeliverableSubmitted":
            results.push({
              name: "DeliverableSubmitted",
              projectId: parsed.args[0],
              milestoneIndex: Number(parsed.args[1]),
              deliverableHash: parsed.args[2],
              reviewDeadline: parsed.args[3],
            });
            break;
          case "RevisionRequested":
            results.push({
              name: "RevisionRequested",
              projectId: parsed.args[0],
              milestoneIndex: Number(parsed.args[1]),
              revisionNumber: Number(parsed.args[2]),
              revisionReasonHash: parsed.args[3],
              newDeadline: parsed.args[4],
            });
            break;
          case "DisputeOpened":
            results.push({
              name: "DisputeOpened",
              projectId: parsed.args[0],
              milestoneIndex: Number(parsed.args[1]),
              initiator: parsed.args[2],
              disputeReasonHash: parsed.args[3],
              disputeTimeout: parsed.args[4],
            });
            break;
          case "MilestoneSettled":
            results.push({
              name: "MilestoneSettled",
              projectId: parsed.args[0],
              milestoneIndex: Number(parsed.args[1]),
              state: Number(parsed.args[2]) as MilestoneState,
              clientAmount: parsed.args[3],
              freelancerAmount: parsed.args[4],
              feeAmount: parsed.args[5],
            });
            break;
          case "CreditsWithdrawn":
            results.push({
              name: "CreditsWithdrawn",
              account: parsed.args[0],
              token: parsed.args[1],
              recipient: parsed.args[2],
              amount: parsed.args[3],
            });
            break;
          case "ProjectCompleted":
            results.push({
              name: "ProjectCompleted",
              projectId: parsed.args[0],
            });
            break;
        }
      } catch {
        // Log was not from escrow interface or not decodable
      }
    }

    return results;
  }
}
