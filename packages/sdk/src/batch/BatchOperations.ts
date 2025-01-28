import { ethers } from "ethers";
import { LancechainClient } from "../client/LancechainClient.js";

export interface BatchAcceptOperation {
  projectId: string;
  milestoneIndex: number;
}

export interface BatchDeliverableOperation {
  projectId: string;
  milestoneIndex: number;
  deliverableHash: string;
}

export interface BatchWithdrawResult {
  token: string;
  amountWithdrawn: bigint;
  txHash: string;
  success: boolean;
  error?: string;
}

export class BatchOperationsManager {
  private client: LancechainClient;

  constructor(client: LancechainClient) {
    this.client = client;
  }

  public async batchAcceptMilestones(
    operations: BatchAcceptOperation[]
  ): Promise<Array<{ operation: BatchAcceptOperation; txHash?: string; success: boolean; error?: string }>> {
    const results: Array<{ operation: BatchAcceptOperation; txHash?: string; success: boolean; error?: string }> = [];

    for (const op of operations) {
      try {
        const receipt = await this.client.acceptMilestone(op.projectId, op.milestoneIndex);
        results.push({
          operation: op,
          txHash: receipt.hash,
          success: true,
        });
      } catch (err) {
        results.push({
          operation: op,
          success: false,
          error: (err as Error).message,
        });
      }
    }

    return results;
  }

  public async batchSubmitDeliverables(
    operations: BatchDeliverableOperation[]
  ): Promise<Array<{ operation: BatchDeliverableOperation; txHash?: string; success: boolean; error?: string }>> {
    const results: Array<{ operation: BatchDeliverableOperation; txHash?: string; success: boolean; error?: string }> = [];

    for (const op of operations) {
      try {
        const receipt = await this.client.submitDeliverable(
          op.projectId,
          op.milestoneIndex,
          op.deliverableHash
        );
        results.push({
          operation: op,
          txHash: receipt.hash,
          success: true,
        });
      } catch (err) {
        results.push({
          operation: op,
          success: false,
          error: (err as Error).message,
        });
      }
    }

    return results;
  }

  public async batchWithdraw(tokens: string[]): Promise<BatchWithdrawResult[]> {
    const results: BatchWithdrawResult[] = [];

    for (const token of tokens) {
      try {
        const res = await this.client.withdraw(token);
        results.push({
          token,
          amountWithdrawn: res.amount,
          txHash: res.receipt.hash,
          success: true,
        });
      } catch (err) {
        results.push({
          token,
          amountWithdrawn: 0n,
          txHash: ethers.ZeroHash,
          success: false,
          error: (err as Error).message,
        });
      }
    }

    return results;
  }

  public async batchCheckCredits(
    account: string,
    tokens: string[]
  ): Promise<Map<string, bigint>> {
    const balances = new Map<string, bigint>();

    for (const token of tokens) {
      try {
        const bal = await this.client.getCredits(account, token);
        balances.set(token.toLowerCase(), bal);
      } catch {
        balances.set(token.toLowerCase(), 0n);
      }
    }

    return balances;
  }
}
