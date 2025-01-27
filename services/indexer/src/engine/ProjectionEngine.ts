import pg from "pg";
import { ethers } from "ethers";
import { LancechainEscrowAbi } from "@lancechain/sdk";
import { LancechainReputationAbi } from "@lancechain/sdk";

export class ProjectionEngine {
  private escrowIface: ethers.Interface;
  private repIface: ethers.Interface;

  constructor() {
    this.escrowIface = new ethers.Interface(LancechainEscrowAbi as unknown as ethers.InterfaceAbi);
    this.repIface = new ethers.Interface(LancechainReputationAbi as unknown as ethers.InterfaceAbi);
  }

  public async applyEvent(
    client: pg.PoolClient,
    chainId: number,
    blockNumber: number,
    eventName: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    switch (eventName) {
      case "TermsAccepted": {
        const projectId = String(payload.projectId);
        const clientAddr = String(payload.client).toLowerCase();
        const freelancer = String(payload.freelancer).toLowerCase();
        const token = String(payload.token).toLowerCase();
        const totalBudget = String(payload.totalBudget);

        await client.query(
          `INSERT INTO projections_projects (
            project_id, client, freelancer, token, total_budget,
            dispute_window, quorum_threshold, timeout_policy, fee_bps, fee_recipient,
            agreement_hash, milestone_count, active_milestone_index, is_settled,
            last_updated_block, created_at_block
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT (project_id) DO UPDATE SET
            last_updated_block = EXCLUDED.last_updated_block;`,
          [
            projectId,
            clientAddr,
            freelancer,
            token,
            totalBudget,
            payload.disputeWindow ?? 86400 * 5,
            payload.quorumThreshold ?? 2,
            payload.timeoutPolicy ?? 2,
            payload.feeBps ?? 250,
            String(payload.feeRecipient ?? ethers.ZeroAddress).toLowerCase(),
            String(payload.agreementHash ?? ethers.ZeroHash),
            payload.milestoneCount ?? 2,
            0,
            false,
            blockNumber,
            blockNumber,
          ]
        );

        // Update liability
        await client.query(
          `INSERT INTO projections_liabilities (token, escrow_liability, credit_liability, total_liability, last_updated_block)
           VALUES ($1, $2, 0, $2, $3)
           ON CONFLICT (token) DO UPDATE SET
             escrow_liability = projections_liabilities.escrow_liability + EXCLUDED.escrow_liability,
             total_liability = projections_liabilities.total_liability + EXCLUDED.escrow_liability,
             last_updated_block = EXCLUDED.last_updated_block;`,
          [token, totalBudget, blockNumber]
        );
        break;
      }

      case "DeliverableSubmitted": {
        const projectId = String(payload.projectId);
        const milestoneIndex = Number(payload.milestoneIndex);
        const deliverableHash = String(payload.deliverableHash);
        const reviewDeadline = String(payload.reviewDeadline);

        await client.query(
          `INSERT INTO projections_milestones (
            project_id, milestone_index, state, amount, delivery_deadline,
            review_deadline, dispute_timeout, review_period, max_revisions, revisions_used,
            dispute_round, deliverable_hash, revision_reason_hash, dispute_reason_hash, last_updated_block
          ) VALUES ($1, $2, 1, 0, 0, $3, 0, 0, 0, 0, 0, $4, '', '', $5)
          ON CONFLICT (project_id, milestone_index) DO UPDATE SET
            state = 1,
            deliverable_hash = EXCLUDED.deliverable_hash,
            review_deadline = EXCLUDED.review_deadline,
            last_updated_block = EXCLUDED.last_updated_block;`,
          [projectId, milestoneIndex, reviewDeadline, deliverableHash, blockNumber]
        );
        break;
      }

      case "RevisionRequested": {
        const projectId = String(payload.projectId);
        const milestoneIndex = Number(payload.milestoneIndex);
        const revisionNumber = Number(payload.revisionNumber);
        const revisionReasonHash = String(payload.revisionReasonHash);
        const newDeadline = String(payload.newDeadline);

        await client.query(
          `UPDATE projections_milestones SET
            state = 2,
            revisions_used = $3,
            revision_reason_hash = $4,
            delivery_deadline = $5,
            review_deadline = 0,
            last_updated_block = $6
           WHERE project_id = $1 AND milestone_index = $2;`,
          [projectId, milestoneIndex, revisionNumber, revisionReasonHash, newDeadline, blockNumber]
        );
        break;
      }

      case "DisputeOpened": {
        const projectId = String(payload.projectId);
        const milestoneIndex = Number(payload.milestoneIndex);
        const disputeReasonHash = String(payload.disputeReasonHash);
        const disputeTimeout = String(payload.disputeTimeout);

        await client.query(
          `UPDATE projections_milestones SET
            state = 3,
            dispute_round = dispute_round + 1,
            dispute_reason_hash = $3,
            dispute_timeout = $4,
            last_updated_block = $5
           WHERE project_id = $1 AND milestone_index = $2;`,
          [projectId, milestoneIndex, disputeReasonHash, disputeTimeout, blockNumber]
        );
        break;
      }

      case "MilestoneSettled": {
        const projectId = String(payload.projectId);
        const milestoneIndex = Number(payload.milestoneIndex);
        const targetState = Number(payload.state);
        const clientAmount = BigInt(String(payload.clientAmount ?? 0));
        const freelancerAmount = BigInt(String(payload.freelancerAmount ?? 0));
        const feeAmount = BigInt(String(payload.feeAmount ?? 0));
        const totalSettled = clientAmount + freelancerAmount + feeAmount;

        // Retrieve project to get counterparties and token
        const projRes = await client.query(
          `SELECT client, freelancer, token, fee_recipient FROM projections_projects WHERE project_id = $1;`,
          [projectId]
        );

        if (projRes.rows.length > 0) {
          const { client: clientAddr, freelancer, token, fee_recipient } = projRes.rows[0];

          // Update milestone
          await client.query(
            `UPDATE projections_milestones SET
              state = $3,
              last_updated_block = $4
             WHERE project_id = $1 AND milestone_index = $2;`,
            [projectId, milestoneIndex, targetState, blockNumber]
          );

          // Update project active milestone
          await client.query(
            `UPDATE projections_projects SET
              active_milestone_index = active_milestone_index + 1,
              last_updated_block = $2
             WHERE project_id = $1;`,
            [projectId, blockNumber]
          );

          // Update liabilities: escrow - totalSettled, credit + totalSettled
          await client.query(
            `UPDATE projections_liabilities SET
              escrow_liability = escrow_liability - $2,
              credit_liability = credit_liability + $2,
              last_updated_block = $3
             WHERE token = $1;`,
            [token, totalSettled.toString(), blockNumber]
          );

          // Credit allocations
          if (clientAmount > 0n) {
            await this._addCredit(client, clientAddr, token, clientAmount.toString(), blockNumber);
          }
          if (freelancerAmount > 0n) {
            await this._addCredit(client, freelancer, token, freelancerAmount.toString(), blockNumber);
          }
          if (feeAmount > 0n) {
            await this._addCredit(client, fee_recipient, token, feeAmount.toString(), blockNumber);
          }
        }
        break;
      }

      case "CreditsWithdrawn": {
        const account = String(payload.account).toLowerCase();
        const token = String(payload.token).toLowerCase();
        const amount = String(payload.amount);

        await client.query(
          `UPDATE projections_credits SET
            credit_balance = credit_balance - $3,
            total_withdrawn = total_withdrawn + $3,
            last_updated_block = $4
           WHERE account = $1 AND token = $2;`,
          [account, token, amount, blockNumber]
        );

        await client.query(
          `UPDATE projections_liabilities SET
            credit_liability = credit_liability - $2,
            total_liability = total_liability - $2,
            last_updated_block = $3
           WHERE token = $1;`,
          [token, amount, blockNumber]
        );
        break;
      }

      case "ProjectCompleted": {
        const projectId = String(payload.projectId);
        await client.query(
          `UPDATE projections_projects SET is_settled = TRUE, last_updated_block = $2 WHERE project_id = $1;`,
          [projectId, blockNumber]
        );
        break;
      }

      case "OutcomeLogged": {
        const counterparty = String(payload.counterparty).toLowerCase();
        const outcome = Number(payload.outcome);

        const isCompleted = outcome === 0 || outcome === 1;
        const isDisputed = outcome === 2;
        const isTimeout = outcome === 3 || outcome === 4;
        const isRefund = outcome === 4 || outcome === 5;

        await client.query(
          `INSERT INTO projections_reputation (
            account, total_projects, completed_count, disputed_count, timeout_count, refund_count, rating_count, total_rating_stars, last_updated_block
          ) VALUES ($1, 1, $2, $3, $4, $5, 0, 0, $6)
          ON CONFLICT (account) DO UPDATE SET
            total_projects = projections_reputation.total_projects + 1,
            completed_count = projections_reputation.completed_count + $2,
            disputed_count = projections_reputation.disputed_count + $3,
            timeout_count = projections_reputation.timeout_count + $4,
            refund_count = projections_reputation.refund_count + $5,
            last_updated_block = $6;`,
          [
            counterparty,
            isCompleted ? 1 : 0,
            isDisputed ? 1 : 0,
            isTimeout ? 1 : 0,
            isRefund ? 1 : 0,
            blockNumber,
          ]
        );
        break;
      }

      case "RatingSubmitted": {
        const projectId = String(payload.projectId);
        const rater = String(payload.rater).toLowerCase();
        const ratee = String(payload.ratee).toLowerCase();
        const score = Number(payload.score);
        const feedbackHash = String(payload.feedbackHash);

        await client.query(
          `INSERT INTO projections_ratings (project_id, rater, ratee, score, feedback_hash, block_number)
           VALUES ($1, $2, $3, $4, $5, $6);`,
          [projectId, rater, ratee, score, feedbackHash, blockNumber]
        );

        await client.query(
          `INSERT INTO projections_reputation (
            account, total_projects, completed_count, disputed_count, timeout_count, refund_count, rating_count, total_rating_stars, last_updated_block
          ) VALUES ($1, 0, 0, 0, 0, 0, 1, $2, $3)
          ON CONFLICT (account) DO UPDATE SET
            rating_count = projections_reputation.rating_count + 1,
            total_rating_stars = projections_reputation.total_rating_stars + $2,
            last_updated_block = $3;`,
          [ratee, score, blockNumber]
        );
        break;
      }
    }
  }

  private async _addCredit(
    client: pg.PoolClient,
    account: string,
    token: string,
    amount: string,
    blockNumber: number
  ): Promise<void> {
    await client.query(
      `INSERT INTO projections_credits (account, token, credit_balance, total_withdrawn, last_updated_block)
       VALUES ($1, $2, $3, 0, $4)
       ON CONFLICT (account, token) DO UPDATE SET
         credit_balance = projections_credits.credit_balance + EXCLUDED.credit_balance,
         last_updated_block = EXCLUDED.last_updated_block;`,
      [account, token, amount, blockNumber]
    );
  }
}
