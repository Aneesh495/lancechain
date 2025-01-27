import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { Database } from "../src/db/Database.js";
import { ProjectionEngine } from "../src/engine/ProjectionEngine.js";
import { ReorgEngine } from "../src/engine/ReorgEngine.js";
import { ethers } from "ethers";

describe("Indexer Reorg Recovery and Interruption Test Suite", () => {
  let db: Database;
  let projectionEngine: ProjectionEngine;
  let reorgEngine: ReorgEngine;
  const chainId = 31337;

  before(async () => {
    db = new Database("postgres://localhost:5432/lancechain_dev");
    await db.migrate();
    projectionEngine = new ProjectionEngine();
    reorgEngine = new ReorgEngine(projectionEngine, 128);
  });

  after(async () => {
    await db.close();
  });

  it("100 Interruption & Restart Cycles: ensures idempotent replay without corruption", async () => {
    await db.clean();

    const client = "0x1111111111111111111111111111111111111111";
    const freelancer = "0x2222222222222222222222222222222222222222";
    const projectId = ethers.keccak256(ethers.toUtf8Bytes("PROJECT_RESTART"));

    // Populate initial state
    await db.withTransaction(async (tx) => {
      await tx.query(
        `INSERT INTO indexer_checkpoints (chain_id, deployment_id, last_indexed_block, last_indexed_hash)
         VALUES ($1, 'dep1', 10, '0xhash10');`,
        [chainId]
      );

      await projectionEngine.applyEvent(tx, chainId, 10, "TermsAccepted", {
        projectId,
        client,
        freelancer,
        token: ethers.ZeroAddress,
        totalBudget: "10000000000000000000",
        milestoneCount: 2,
      });
    });

    // Run 100 interruption/restart cycles
    for (let cycle = 1; cycle <= 100; cycle++) {
      await db.withTransaction(async (tx) => {
        // Re-read checkpoint
        const cp = await tx.query(
          `SELECT last_indexed_block FROM indexer_checkpoints WHERE chain_id = $1;`,
          [chainId]
        );
        assert.strictEqual(Number(cp.rows[0].last_indexed_block), 10);

        // Re-apply event idempotently
        await projectionEngine.applyEvent(tx, chainId, 10, "TermsAccepted", {
          projectId,
          client,
          freelancer,
          token: ethers.ZeroAddress,
          totalBudget: "10000000000000000000",
          milestoneCount: 2,
        });

        // Simulate random mid-sync interruption (abort 50% of the time, commit other 50%)
        if (cycle % 2 === 0) {
          throw new Error("SimulatedCrashMidBatch");
        }
      }).catch(() => {
        // Expected crash
      });
    }

    // Verify projection integrity remains exactly 1 project and correct liabilities
    const projRows = await db.query<{ project_id: string; total_budget: string }>(
      `SELECT project_id, total_budget FROM projections_projects;`
    );
    assert.strictEqual(projRows.length, 1);
    assert.strictEqual(projRows[0].project_id, projectId);

    const liabRows = await db.query(`SELECT escrow_liability FROM projections_liabilities WHERE token = $1;`, [ethers.ZeroAddress]);
    assert.strictEqual(liabRows.length, 1);
  });

  it("100 Alternate-Branch Reorg Cases: detects parent mismatch, unwinds, and replays replacement branch", async () => {
    await db.clean();

    let currentParent = "0xgenesis";
    const canonicalBlocks: Array<{ number: number; hash: string; parent: string }> = [];

    // Build base canonical chain: blocks 1 to 20
    for (let b = 1; b <= 20; b++) {
      const hash = ethers.keccak256(ethers.toUtf8Bytes(`BLOCK_${b}_CANONICAL`));
      canonicalBlocks.push({ number: b, hash, parent: currentParent });
      await db.query(
        `INSERT INTO journal_blocks (chain_id, block_number, block_hash, parent_hash, block_timestamp, is_canonical)
         VALUES ($1, $2, $3, $4, $5, TRUE);`,
        [chainId, b, hash, currentParent, 1700000000 + b * 12]
      );
      currentParent = hash;
    }

    const canonicalHashesList = canonicalBlocks.map((b) => `'${b.hash}'`).join(",");

    // Run 100 alternate-branch reorg scenarios
    for (let r = 1; r <= 100; r++) {
      // Reorg depth between 1 and 5 blocks
      const reorgDepth = (r % 5) + 1;
      const forkPoint = 20 - reorgDepth;
      const commonAncestor = canonicalBlocks[forkPoint - 1];

      // Clean alternate blocks from previous iteration and reset canonical chain
      await db.query(
        `DELETE FROM journal_blocks WHERE chain_id = $1 AND block_hash NOT IN (${canonicalHashesList});`,
        [chainId]
      );
      await db.query(
        `UPDATE journal_blocks SET is_canonical = TRUE WHERE chain_id = $1;`,
        [chainId]
      );
      await db.query(
        `INSERT INTO indexer_checkpoints (chain_id, deployment_id, last_indexed_block, last_indexed_hash, reorg_count)
         VALUES ($1, 'dep1', 20, $2, $3)
         ON CONFLICT (chain_id) DO UPDATE SET last_indexed_block = 20, last_indexed_hash = $2;`,
        [chainId, canonicalBlocks[19].hash, r - 1]
      );

      // Create alternate branch block
      const altBlockNumber = forkPoint + 1;
      const altParentHash = (forkPoint === 0) ? "0xgenesis" : commonAncestor.hash;
      const altBlockHash = ethers.keccak256(ethers.toUtf8Bytes(`ALT_BRANCH_${r}_BLOCK_${altBlockNumber}`));

      // Mock provider returning canonical hashes up to commonAncestor, and new hashes above it
      const mockProvider = {
        getBlock: async (n: number) => {
          if (n >= 1 && n <= commonAncestor.number) {
            return { hash: canonicalBlocks[n - 1].hash };
          }
          return { hash: ethers.keccak256(ethers.toUtf8Bytes(`ALT_CHAIN_${r}_${n}`)) };
        },
      } as unknown as ethers.Provider;

      await db.withTransaction(async (tx) => {
        const resolution = await reorgEngine.detectAndResolveReorg(
          tx,
          mockProvider,
          chainId,
          altBlockNumber,
          altParentHash
        );

        assert.strictEqual(resolution.detected, true);
        assert.strictEqual(resolution.orphanedBlockCount, reorgDepth);

        // Insert new alternate block
        await tx.query(
          `INSERT INTO journal_blocks (chain_id, block_number, block_hash, parent_hash, block_timestamp, is_canonical)
           VALUES ($1, $2, $3, $4, $5, TRUE)
           ON CONFLICT (chain_id, block_hash) DO UPDATE SET is_canonical = TRUE;`,
          [chainId, altBlockNumber, altBlockHash, altParentHash, 1700000000 + altBlockNumber * 12]
        );
      });
    }

    // Verify reorg counter reached 100
    const cpRes = await db.query<{ reorg_count: number }>(
      `SELECT reorg_count FROM indexer_checkpoints WHERE chain_id = $1;`,
      [chainId]
    );
    assert.strictEqual(Number(cpRes[0].reorg_count), 100);
  });
});
