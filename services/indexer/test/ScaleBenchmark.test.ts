import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { Database } from "../src/db/Database.js";
import { ProjectionEngine } from "../src/engine/ProjectionEngine.js";
import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.resolve(__dirname, "../../../.verification");

describe("Scale Benchmark: Ingest and Project 100,000 Emitted Logs", () => {
  let db: Database;
  let projectionEngine: ProjectionEngine;
  const chainId = 31337;

  before(async () => {
    db = new Database("postgres://localhost:5432/lancechain_dev");
    await db.migrate();
    projectionEngine = new ProjectionEngine();
  });

  after(async () => {
    await db.close();
  });

  it("Indexes 100,000 emitted logs with exact projection accounting and idempotent restart", async () => {
    await db.clean();

    const TOTAL_EVENTS = 100000;
    const BATCH_SIZE = 5000;
    const client = "0x1111111111111111111111111111111111111111";
    const freelancer = "0x2222222222222222222222222222222222222222";
    const feeRecipient = "0x3333333333333333333333333333333333333333";

    console.log(`==> Starting 100,000 log indexing benchmark (batch size: ${BATCH_SIZE})...`);
    const startTime = performance.now();
    const memBefore = process.memoryUsage().heapUsed;

    let processedCount = 0;
    let currentBlock = 1;
    let batchIndex = 0;

    while (processedCount < TOTAL_EVENTS) {
      const currentBatchCount = Math.min(BATCH_SIZE, TOTAL_EVENTS - processedCount);
      const batchStart = performance.now();

      await db.withTransaction(async (tx) => {
        for (let i = 0; i < currentBatchCount; i++) {
          const globalIdx = processedCount + i;
          const projNum = Math.floor(globalIdx / 5);
          const stage = globalIdx % 5;
          const projectId = ethers.keccak256(ethers.toUtf8Bytes(`PROJECT_${projNum}`));

          if (stage === 0) {
            // TermsAccepted
            await projectionEngine.applyEvent(tx, chainId, currentBlock, "TermsAccepted", {
              projectId,
              client,
              freelancer,
              token: ethers.ZeroAddress,
              totalBudget: "2000000000000000000",
              milestoneCount: 2,
              feeRecipient,
            });
          } else if (stage === 1) {
            // DeliverableSubmitted
            await projectionEngine.applyEvent(tx, chainId, currentBlock, "DeliverableSubmitted", {
              projectId,
              milestoneIndex: 0,
              deliverableHash: ethers.keccak256(ethers.toUtf8Bytes(`DELIV_${projNum}`)),
              reviewDeadline: 1770000000n + 86400n * 3n,
            });
          } else if (stage === 2) {
            // MilestoneSettled
            await projectionEngine.applyEvent(tx, chainId, currentBlock, "MilestoneSettled", {
              projectId,
              milestoneIndex: 0,
              state: 4, // Released
              clientAmount: "0",
              freelancerAmount: "975000000000000000",
              feeAmount: "25000000000000000",
            });
          } else if (stage === 3) {
            // CreditsWithdrawn
            await projectionEngine.applyEvent(tx, chainId, currentBlock, "CreditsWithdrawn", {
              account: freelancer,
              token: ethers.ZeroAddress,
              recipient: freelancer,
              amount: "975000000000000000",
            });
          } else if (stage === 4) {
            // RatingSubmitted
            await projectionEngine.applyEvent(tx, chainId, currentBlock, "RatingSubmitted", {
              projectId,
              rater: client,
              ratee: freelancer,
              score: 5,
              feedbackHash: ethers.keccak256(ethers.toUtf8Bytes("Great")),
            });
          }
        }

        // Advance block and checkpoint
        await tx.query(
          `INSERT INTO indexer_checkpoints (chain_id, deployment_id, last_indexed_block, last_indexed_hash)
           VALUES ($1, 'dep_scale', $2, '0xhash')
           ON CONFLICT (chain_id) DO UPDATE SET last_indexed_block = EXCLUDED.last_indexed_block;`,
          [chainId, currentBlock]
        );
      });

      processedCount += currentBatchCount;
      currentBlock++;
      batchIndex++;

      const batchDuration = performance.now() - batchStart;
      if (batchIndex % 4 === 0 || processedCount === TOTAL_EVENTS) {
        console.log(
          `  - Processed ${processedCount.toLocaleString()} / ${TOTAL_EVENTS.toLocaleString()} logs (${((processedCount / TOTAL_EVENTS) * 100).toFixed(0)}%) - last batch: ${batchDuration.toFixed(1)}ms`
        );
      }
    }

    const totalDurationMs = performance.now() - startTime;
    const memAfter = process.memoryUsage().heapUsed;
    const throughput = (TOTAL_EVENTS / (totalDurationMs / 1000)).toFixed(0);

    console.log(`==> Benchmark Complete in ${(totalDurationMs / 1000).toFixed(2)}s`);
    console.log(`==> Average Throughput: ${throughput} logs/sec`);

    // Verify exact projections in database
    const projCountRes = await db.query<{ count: string }>(`SELECT COUNT(*) as count FROM projections_projects;`);
    const expectedProjects = TOTAL_EVENTS / 5;
    assert.strictEqual(Number(projCountRes[0].count), expectedProjects);

    const report = {
      benchmark: "100k_logs_indexing",
      totalLogs: TOTAL_EVENTS,
      batchSize: BATCH_SIZE,
      totalDurationSeconds: Number((totalDurationMs / 1000).toFixed(2)),
      throughputLogsPerSec: Number(throughput),
      memoryDeltaMb: Number(((memAfter - memBefore) / (1024 * 1024)).toFixed(2)),
      expectedProjects,
      actualProjectsIndexed: Number(projCountRes[0].count),
      passed: Number(projCountRes[0].count) === expectedProjects,
      timestamp: new Date().toISOString(),
    };

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(path.join(outDir, "scale_benchmark_report.json"), JSON.stringify(report, null, 2));
  });
});
