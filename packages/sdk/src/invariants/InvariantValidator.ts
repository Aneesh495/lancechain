import { MilestoneState } from "../types.js";
import { LancechainError } from "../errors/LancechainErrors.js";

export interface SolvencyCheckResult {
  isSolvent: boolean;
  contractBalance: bigint;
  totalObligations: bigint;
  delta: bigint;
  breakdown: {
    escrowLiabilities: bigint;
    withdrawableBalances: bigint;
    accumulatedFees: bigint;
  };
}

export interface ConservationCheckResult {
  isConserved: boolean;
  milestoneAmount: bigint;
  sumAllocated: bigint;
  delta: bigint;
  allocations: {
    clientAmount: bigint;
    freelancerNet: bigint;
    protocolFee: bigint;
  };
}

export class InvariantValidator {
  /**
   * Invariant 1: Total Contract Solvency
   * Contract Balance must equal or exceed total obligations (escrow liabilities + pull balances + protocol fees).
   */
  public static verifySolvency(
    contractBalance: bigint,
    escrowLiabilities: bigint,
    withdrawableBalances: bigint,
    accumulatedFees: bigint
  ): SolvencyCheckResult {
    const totalObligations = escrowLiabilities + withdrawableBalances + accumulatedFees;
    const delta = contractBalance - totalObligations;
    const isSolvent = delta >= 0n;

    if (!isSolvent) {
      throw new LancechainError(
        "SOLVENCY_VIOLATION",
        `Solvency Invariant Violation: Balance ${contractBalance} < Obligations ${totalObligations} (Deficit: ${delta})`,
        { contractBalance, escrowLiabilities, withdrawableBalances, accumulatedFees, delta }
      );
    }

    return {
      isSolvent,
      contractBalance,
      totalObligations,
      delta,
      breakdown: {
        escrowLiabilities,
        withdrawableBalances,
        accumulatedFees,
      },
    };
  }

  /**
   * Invariant 2: Exact Sum Conservation
   * Payouts must exactly sum to the funded milestone amount. No funds may appear or vanish.
   */
  public static verifySumConservation(
    milestoneAmount: bigint,
    clientAmount: bigint,
    freelancerNet: bigint,
    protocolFee: bigint
  ): ConservationCheckResult {
    const sumAllocated = clientAmount + freelancerNet + protocolFee;
    const delta = milestoneAmount - sumAllocated;
    const isConserved = delta === 0n;

    if (!isConserved) {
      throw new LancechainError(
        "SUM_CONSERVATION_VIOLATION",
        `Sum Conservation Invariant Violation: Milestone Amount ${milestoneAmount} != Sum Allocated ${sumAllocated} (Delta: ${delta})`,
        { milestoneAmount, clientAmount, freelancerNet, protocolFee, delta }
      );
    }

    return {
      isConserved,
      milestoneAmount,
      sumAllocated,
      delta,
      allocations: {
        clientAmount,
        freelancerNet,
        protocolFee,
      },
    };
  }

  /**
   * Invariant 3: Valid State Transition Machine
   * Validates legal status transitions for milestones.
   */
  public static isValidMilestoneTransition(
    currentStatus: MilestoneState,
    targetStatus: MilestoneState
  ): boolean {
    switch (currentStatus) {
      case MilestoneState.Pending:
        return targetStatus === MilestoneState.Submitted || targetStatus === MilestoneState.Refunded;
      case MilestoneState.Submitted:
        return (
          targetStatus === MilestoneState.Released ||
          targetStatus === MilestoneState.RevisionRequested ||
          targetStatus === MilestoneState.Disputed
        );
      case MilestoneState.RevisionRequested:
        return targetStatus === MilestoneState.Submitted || targetStatus === MilestoneState.Disputed;
      case MilestoneState.Disputed:
        return targetStatus === MilestoneState.SplitSettled || targetStatus === MilestoneState.Released || targetStatus === MilestoneState.Refunded;
      case MilestoneState.Released:
      case MilestoneState.Refunded:
      case MilestoneState.SplitSettled:
        return false; // Terminal states
      default:
        return false;
    }
  }

  /**
   * Invariant 4: Pull Ledger Non-Negativity
   * Asserts that no account's withdrawable balance is negative.
   */
  public static verifyPullLedgerBalances(balances: Map<string, bigint>): boolean {
    for (const [account, bal] of balances.entries()) {
      if (bal < 0n) {
        throw new LancechainError(
          "NEGATIVE_BALANCE",
          `Pull Ledger Invariant Violation: Account ${account} has negative balance ${bal}`,
          { account, balance: bal }
        );
      }
    }
    return true;
  }
}
