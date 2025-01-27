import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { createApiServer } from "../src/server.js";
import { Database } from "@lancechain/indexer";
import http from "http";
import { ethers } from "ethers";

describe("Lancechain Read API Integration Tests", () => {
  let db: Database;
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    db = new Database("postgres://localhost:5432/lancechain_dev");
    await db.migrate();
    await db.clean();

    // Seed test data
    const projectId = ethers.keccak256(ethers.toUtf8Bytes("API_TEST_PROJ"));
    const client = "0x1111111111111111111111111111111111111111";
    const freelancer = "0x2222222222222222222222222222222222222222";

    await db.query(
      `INSERT INTO indexer_checkpoints (chain_id, deployment_id, last_indexed_block, last_indexed_hash)
       VALUES (31337, 'test_dep', 42, '0xhash42');`
    );

    await db.query(
      `INSERT INTO projections_projects (
        project_id, client, freelancer, token, total_budget, dispute_window, quorum_threshold,
        timeout_policy, fee_bps, fee_recipient, agreement_hash, milestone_count,
        active_milestone_index, is_settled, last_updated_block, created_at_block
      ) VALUES ($1, $2, $3, $4, 1000, 3600, 2, 2, 250, $2, '0xagree', 1, 0, false, 42, 42);`,
      [projectId, client, freelancer, ethers.ZeroAddress]
    );

    await db.query(
      `INSERT INTO projections_milestones (
        project_id, milestone_index, state, amount, delivery_deadline, review_deadline,
        dispute_timeout, review_period, max_revisions, revisions_used, dispute_round,
        deliverable_hash, revision_reason_hash, dispute_reason_hash, last_updated_block
      ) VALUES ($1, 0, 0, 1000, 1770000000, 0, 0, 86400, 2, 0, 0, '', '', '', 42);`,
      [projectId]
    );

    await db.query(
      `INSERT INTO projections_credits (account, token, credit_balance, total_withdrawn, last_updated_block)
       VALUES ($1, $2, 500, 100, 42);`,
      [freelancer, ethers.ZeroAddress]
    );

    await db.query(
      `INSERT INTO projections_reputation (
        account, total_projects, completed_count, disputed_count, timeout_count, refund_count, rating_count, total_rating_stars, last_updated_block
      ) VALUES ($1, 5, 4, 1, 0, 0, 3, 14, 42);`,
      [freelancer]
    );

    const app = createApiServer({ db, chainId: 31337 });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address() as { port: number };
        baseUrl = `http://localhost:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    server?.close();
    await db.close();
  });

  it("GET /api/health: reports healthy status", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json() as { status: string };
    assert.strictEqual(data.status, "healthy");
  });

  it("GET /api/status: reports indexer head and checkpoint details", async () => {
    const res = await fetch(`${baseUrl}/api/status`);
    assert.strictEqual(res.status, 200);
    const data = await res.json() as { lastIndexedBlock: number; chainId: number };
    assert.strictEqual(data.chainId, 31337);
    assert.strictEqual(data.lastIndexedBlock, 42);
  });

  it("GET /api/projects: returns list with seeded project", async () => {
    const res = await fetch(`${baseUrl}/api/projects`);
    assert.strictEqual(res.status, 200);
    const data = await res.json() as { projects: Array<{ project_id: string }>; count: number };
    assert.strictEqual(data.count >= 1, true);
    assert.strictEqual(data.projects[0].project_id.length, 66);
  });

  it("GET /api/accounts/:address/credits: returns credit balances", async () => {
    const freelancer = "0x2222222222222222222222222222222222222222";
    const res = await fetch(`${baseUrl}/api/accounts/${freelancer}/credits`);
    assert.strictEqual(res.status, 200);
    const data = await res.json() as { credits: Array<{ credit_balance: string }> };
    assert.strictEqual(data.credits.length, 1);
    assert.strictEqual(data.credits[0].credit_balance, "500");
  });

  it("GET /api/reputation/:address: returns reputation breakdown and average score", async () => {
    const freelancer = "0x2222222222222222222222222222222222222222";
    const res = await fetch(`${baseUrl}/api/reputation/${freelancer}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json() as { score: { averageRating: number; completedCount: number } };
    assert.strictEqual(data.score.completedCount, 4);
    assert.strictEqual(data.score.averageRating, 4.67);
  });
});
