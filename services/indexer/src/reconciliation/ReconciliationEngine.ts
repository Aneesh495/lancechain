import { ethers } from "ethers";
import { Database } from "../db/Database.js";
import { LancechainClient } from "@lancechain/sdk";
import { ReconciliationReport } from "../types.js";

export class ReconciliationEngine {
  private db: Database;
  private client: LancechainClient;

  constructor(db: Database, client: LancechainClient) {
    this.db = db;
    this.client = client;
  }

  public async reconcile(chainId: number): Promise<ReconciliationReport> {
    const cpRows = await this.db.query<{ lastIndexedBlock: number; lastIndexedHash: string }>(
      `SELECT last_indexed_block as "lastIndexedBlock", last_indexed_hash as "lastIndexedHash"
       FROM indexer_checkpoints WHERE chain_id = $1;`,
      [chainId]
    );

    if (cpRows.length === 0) {
      return {
        blockNumber: 0,
        blockHash: ethers.ZeroHash,
        passed: true,
        mismatches: [],
        timestamp: new Date().toISOString(),
      };
    }

    const { lastIndexedBlock, lastIndexedHash } = cpRows[0];
    const blockTag = Number(lastIndexedBlock);
    const mismatches: ReconciliationReport["mismatches"] = [];

    // 1. Reconcile Liabilities
    const liabilityRows = await this.db.query<{
      token: string;
      escrow_liability: string;
      credit_liability: string;
      total_liability: string;
    }>(`SELECT token, escrow_liability, credit_liability, total_liability FROM projections_liabilities;`);

    for (const row of liabilityRows) {
      const onChainLiab = await this.client.getLiabilities(row.token);
      if (
        BigInt(row.escrow_liability) !== onChainLiab.escrowLiability ||
        BigInt(row.credit_liability) !== onChainLiab.creditLiability ||
        BigInt(row.total_liability) !== onChainLiab.totalLiability
      ) {
        mismatches.push({
          category: "liability",
          identifier: row.token,
          expectedOnChain: {
            escrow: onChainLiab.escrowLiability.toString(),
            credit: onChainLiab.creditLiability.toString(),
            total: onChainLiab.totalLiability.toString(),
          },
          actualProjected: {
            escrow: row.escrow_liability,
            credit: row.credit_liability,
            total: row.total_liability,
          },
        });
      }
    }

    // 2. Reconcile Projects & Milestones
    const projectRows = await this.db.query<{
      project_id: string;
      active_milestone_index: number;
      is_settled: boolean;
    }>(`SELECT project_id, active_milestone_index, is_settled FROM projections_projects;`);

    for (const projRow of projectRows) {
      try {
        const onChainProj = await this.client.getProject(projRow.project_id);
        if (
          onChainProj.isSettled !== projRow.is_settled ||
          onChainProj.milestones.length !== onChainProj.milestoneCount
        ) {
          mismatches.push({
            category: "project",
            identifier: projRow.project_id,
            expectedOnChain: { isSettled: onChainProj.isSettled },
            actualProjected: { isSettled: projRow.is_settled },
          });
        }

        // Check milestones
        const milestoneRows = await this.db.query<{
          milestone_index: number;
          state: number;
        }>(
          `SELECT milestone_index, state FROM projections_milestones WHERE project_id = $1 ORDER BY milestone_index ASC;`,
          [projRow.project_id]
        );

        for (const mRow of milestoneRows) {
          const onChainM = onChainProj.milestones[mRow.milestone_index];
          if (onChainM && onChainM.state !== mRow.state) {
            mismatches.push({
              category: "milestone",
              identifier: `${projRow.project_id}#${mRow.milestone_index}`,
              expectedOnChain: onChainM.state,
              actualProjected: mRow.state,
            });
          }
        }
      } catch {
        // Project might not exist at this block
      }
    }

    // 3. Reconcile Credits
    const creditRows = await this.db.query<{
      account: string;
      token: string;
      credit_balance: string;
    }>(`SELECT account, token, credit_balance FROM projections_credits WHERE credit_balance > 0;`);

    for (const cRow of creditRows) {
      const onChainBal = await this.client.getCredits(cRow.account, cRow.token);
      if (onChainBal !== BigInt(cRow.credit_balance)) {
        mismatches.push({
          category: "credit",
          identifier: `${cRow.account}#${cRow.token}`,
          expectedOnChain: onChainBal.toString(),
          actualProjected: cRow.credit_balance,
        });
      }
    }

    // 4. Reconcile Reputation
    const repRows = await this.db.query<{
      account: string;
      completed_count: number;
      disputed_count: number;
      rating_count: number;
    }>(`SELECT account, completed_count, disputed_count, rating_count FROM projections_reputation;`);

    for (const rRow of repRows) {
      const onChainScore = await this.client.getReputationScore(rRow.account);
      if (
        onChainScore.completedCount !== rRow.completed_count ||
        onChainScore.disputedCount !== rRow.disputed_count ||
        onChainScore.ratingCount !== rRow.rating_count
      ) {
        mismatches.push({
          category: "reputation",
          identifier: rRow.account,
          expectedOnChain: onChainScore,
          actualProjected: rRow,
        });
      }
    }

    return {
      blockNumber: blockTag,
      blockHash: lastIndexedHash,
      passed: mismatches.length === 0,
      mismatches,
      timestamp: new Date().toISOString(),
    };
  }
}
