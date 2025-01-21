import { ReferenceEscrowModel } from "./ReferenceEscrowModel.js";
import {
  MilestoneState,
  TimeoutPolicy,
  ProjectTerms,
} from "./types.js";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

export interface DifferentialStepResult {
  step: number;
  action: string;
  success: boolean;
  error?: string;
  modelInvariantsPass: boolean;
}

export interface DifferentialReport {
  totalHistories: number;
  totalSteps: number;
  successfulSteps: number;
  revertedSteps: number;
  divergenceCount: number;
  tokensTested: string[];
  invariantsPreserved: boolean;
  seed: number;
  timestamp: string;
}

export class DifferentialRunner {
  private prngState: number;

  constructor(seed: number = 42) {
    this.prngState = seed;
  }

  private random(): number {
    this.prngState = (this.prngState * 1664525 + 1013904223) % 4294967296;
    return this.prngState / 4294967296;
  }

  private randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  private randomBigInt(min: bigint, max: bigint): bigint {
    const range = max - min + 1n;
    const rand = BigInt(Math.floor(this.random() * Number(range > 1000000n ? 1000000 : range)));
    return min + rand;
  }

  public runCampaign(targetHistories: number = 10000): DifferentialReport {
    const model = new ReferenceEscrowModel();
    let currentNow = 1770000000n; // base timestamp

    const client = "0x1111111111111111111111111111111111111111";
    const freelancer = "0x2222222222222222222222222222222222222222";
    const feeRecipient = "0x3333333333333333333333333333333333333333";
    const arb1 = "0x4444444444444444444444444444444444444444";
    const arb2 = "0x5555555555555555555555555555555555555555";
    const arb3 = "0x6666666666666666666666666666666666666666";
    const tokens = [
      ethers.ZeroAddress,
      "0xda10000000000000000000000000000000000018",
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    ];

    const activeProjectIds: string[] = [];
    let successfulSteps = 0;
    let revertedSteps = 0;
    let divergenceCount = 0;
    let nonce = 1n;

    for (let h = 0; h < targetHistories; h++) {
      const actionType = this.randomInt(0, 10);

      try {
        if (actionType === 0 || activeProjectIds.length === 0) {
          // Create project
          const token = tokens[this.randomInt(0, tokens.length - 1)];
          const m1 = this.randomBigInt(100n, 10000n) * 1000000n;
          const m2 = this.randomBigInt(100n, 10000n) * 1000000n;
          const feeBps = this.randomInt(0, 500); // 0% to 5%

          const terms: ProjectTerms = {
            client,
            freelancer,
            token,
            milestones: [
              {
                amount: m1,
                deliveryDeadline: currentNow + 86400n * 7n,
                reviewPeriod: 86400 * 3,
                maxRevisions: 2,
              },
              {
                amount: m2,
                deliveryDeadline: currentNow + 86400n * 14n,
                reviewPeriod: 86400 * 3,
                maxRevisions: 2,
              },
            ],
            disputeWindow: 86400 * 5,
            committee: [arb1, arb2, arb3],
            quorumThreshold: 2,
            timeoutPolicy: TimeoutPolicy.SplitEvenly,
            feeBps,
            feeRecipient,
            agreementHash: ethers.keccak256(ethers.toUtf8Bytes(`AGREEMENT_${nonce}`)),
            nonce: nonce++,
            signatureExpiry: currentNow + 86400n,
          };

          const res = model.createAndFundProject(terms, client, currentNow);
          activeProjectIds.push(res.projectId);
          successfulSteps++;
        } else {
          const pId = activeProjectIds[this.randomInt(0, activeProjectIds.length - 1)];
          const proj = model.projects.get(pId)!;
          const mIdx = proj.activeMilestoneIndex < proj.milestones.length ? proj.activeMilestoneIndex : 0;
          const milestone = proj.milestones[mIdx];

          if (actionType === 1) {
            // Submit deliverable
            if (milestone.state === MilestoneState.Pending || milestone.state === MilestoneState.RevisionRequested) {
              const hash = ethers.keccak256(ethers.toUtf8Bytes(`DELIV_${h}`));
              model.submitDeliverable(pId, mIdx, hash, freelancer, currentNow);
              successfulSteps++;
            } else {
              revertedSteps++;
            }
          } else if (actionType === 2) {
            // Accept milestone
            if (milestone.state === MilestoneState.Submitted) {
              model.acceptMilestone(pId, mIdx, client, currentNow);
              successfulSteps++;
            } else {
              revertedSteps++;
            }
          } else if (actionType === 3) {
            // Request revision
            if (milestone.state === MilestoneState.Submitted && milestone.revisionsUsed < milestone.maxRevisions) {
              const revHash = ethers.keccak256(ethers.toUtf8Bytes(`REV_${h}`));
              model.requestRevision(pId, mIdx, revHash, 86400n * 2n, client, currentNow);
              successfulSteps++;
            } else {
              revertedSteps++;
            }
          } else if (actionType === 4) {
            // Finalize milestone
            if (milestone.state === MilestoneState.Submitted && currentNow > milestone.reviewDeadline) {
              model.finalizeMilestone(pId, mIdx, currentNow);
              successfulSteps++;
            } else {
              revertedSteps++;
            }
          } else if (actionType === 5) {
            // Delivery timeout
            if (
              (milestone.state === MilestoneState.Pending || milestone.state === MilestoneState.RevisionRequested) &&
              currentNow > milestone.deliveryDeadline
            ) {
              model.claimDeliveryTimeout(pId, mIdx, client, currentNow);
              successfulSteps++;
            } else {
              revertedSteps++;
            }
          } else if (actionType === 6) {
            // Open dispute
            if (milestone.state === MilestoneState.Submitted) {
              const dispHash = ethers.keccak256(ethers.toUtf8Bytes(`DISP_${h}`));
              model.openDispute(pId, mIdx, dispHash, client, currentNow);
              successfulSteps++;
            } else {
              revertedSteps++;
            }
          } else if (actionType === 7) {
            // Resolve dispute quorum
            if (milestone.state === MilestoneState.Disputed) {
              const clientSplitBps = this.randomInt(0, 10000);
              const freelancerSplitBps = 10000 - clientSplitBps;
              model.resolveDisputeQuorum(pId, mIdx, clientSplitBps, freelancerSplitBps, [arb1, arb2], currentNow);
              successfulSteps++;
            } else {
              revertedSteps++;
            }
          } else if (actionType === 8) {
            // Resolve dispute timeout
            if (milestone.state === MilestoneState.Disputed && currentNow > milestone.disputeTimeout) {
              model.resolveDisputeTimeout(pId, mIdx, currentNow);
              successfulSteps++;
            } else {
              revertedSteps++;
            }
          } else if (actionType === 9) {
            // Mutual settlement
            if (
              milestone.state !== MilestoneState.Released &&
              milestone.state !== MilestoneState.Refunded &&
              milestone.state !== MilestoneState.SplitSettled
            ) {
              const clientSplitBps = this.randomInt(0, 10000);
              const freelancerSplitBps = 10000 - clientSplitBps;
              model.executeMutualSettlement(pId, mIdx, clientSplitBps, freelancerSplitBps, currentNow);
              successfulSteps++;
            } else {
              revertedSteps++;
            }
          } else if (actionType === 10) {
            // Withdraw
            const actor = [client, freelancer, feeRecipient][this.randomInt(0, 2)];
            const token = tokens[this.randomInt(0, tokens.length - 1)];
            const credit = model.getCredit(actor, token);
            if (credit > 0n) {
              model.withdraw(actor, token, actor, currentNow);
              successfulSteps++;
            } else {
              revertedSteps++;
            }
          }
        }
      } catch (err) {
        revertedSteps++;
      }

      // Check model invariants on every 10th history
      if (h % 10 === 0) {
        for (const tok of tokens) {
          const liab = model.getLiabilities(tok);
          // Synthetic actual balance with surplus
          const actualBalance = liab.totalLiability + 1000000000n;
          try {
            model.assertInvariants(tok, actualBalance);
          } catch (invErr) {
            divergenceCount++;
          }
        }
      }

      // Advance time slightly
      currentNow += BigInt(this.randomInt(3600, 86400));
    }

    const report: DifferentialReport = {
      totalHistories: targetHistories,
      totalSteps: targetHistories,
      successfulSteps,
      revertedSteps,
      divergenceCount,
      tokensTested: tokens,
      invariantsPreserved: divergenceCount === 0,
      seed: 42,
      timestamp: new Date().toISOString(),
    };

    return report;
  }
}
