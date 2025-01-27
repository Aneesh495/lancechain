import pg from "pg";
import { ethers } from "ethers";
import { ProjectionEngine } from "./ProjectionEngine.js";
import { ReorgResolution } from "../types.js";

export class FatalReorgDepthExceededError extends Error {
  constructor(depth: number, maxAllowed: number) {
    super(`Fatal reorg depth ${depth} exceeded maximum allowed depth ${maxAllowed}. Manual snapshot rebuild required.`);
    this.name = "FatalReorgDepthExceededError";
  }
}

export class ReorgEngine {
  private projectionEngine: ProjectionEngine;
  private maxDepth: number;

  constructor(projectionEngine: ProjectionEngine, maxDepth: number = 128) {
    this.projectionEngine = projectionEngine;
    this.maxDepth = maxDepth;
  }

  public async detectAndResolveReorg(
    client: pg.PoolClient,
    provider: ethers.Provider,
    chainId: number,
    newBlockNumber: number,
    newParentHash: string
  ): Promise<ReorgResolution> {
    const cpRes = await client.query(
      `SELECT last_indexed_block, last_indexed_hash FROM indexer_checkpoints WHERE chain_id = $1;`,
      [chainId]
    );

    if (cpRes.rows.length === 0) {
      return {
        detected: false,
        commonAncestorNumber: newBlockNumber - 1,
        commonAncestorHash: newParentHash,
        orphanedBlockCount: 0,
        replacementBlockCount: 0,
      };
    }

    const lastBlockNum = Number(cpRes.rows[0].last_indexed_block);
    const lastHash = String(cpRes.rows[0].last_indexed_hash);

    // Normal linear extension
    if (newBlockNumber === lastBlockNum + 1 && newParentHash.toLowerCase() === lastHash.toLowerCase()) {
      return {
        detected: false,
        commonAncestorNumber: lastBlockNum,
        commonAncestorHash: lastHash,
        orphanedBlockCount: 0,
        replacementBlockCount: 0,
      };
    }

    // Reorg detected!
    console.warn(
      `[ReorgEngine] Reorg detected! Block ${newBlockNumber} (parent: ${newParentHash}) arrived while checkpoint at ${lastBlockNum} (${lastHash})`
    );

    // Trace backwards to locate common ancestor
    let ancestorNumber = Math.min(newBlockNumber - 1, lastBlockNum);
    let commonAncestorHash = "";
    let found = false;

    while (ancestorNumber >= 0 && (lastBlockNum - ancestorNumber) <= this.maxDepth) {
      const canonicalRecordRes = await client.query(
        `SELECT block_hash FROM journal_blocks WHERE chain_id = $1 AND block_number = $2 AND is_canonical = TRUE;`,
        [chainId, ancestorNumber]
      );

      if (canonicalRecordRes.rows.length > 0) {
        const canonicalHash = canonicalRecordRes.rows[0].block_hash;
        const chainBlock = await provider.getBlock(ancestorNumber);

        if (chainBlock && chainBlock.hash && chainBlock.hash.toLowerCase() === canonicalHash.toLowerCase()) {
          commonAncestorHash = canonicalHash;
          found = true;
          break;
        }
      }
      ancestorNumber--;
    }

    if (!found) {
      throw new FatalReorgDepthExceededError(lastBlockNum - ancestorNumber, this.maxDepth);
    }

    const orphanedCount = lastBlockNum - ancestorNumber;
    console.log(
      `[ReorgEngine] Common ancestor confirmed at block ${ancestorNumber} (${commonAncestorHash}). Unwinding ${orphanedCount} orphaned blocks.`
    );

    // 1. Invalidate orphaned journal entries
    await client.query(
      `UPDATE journal_blocks SET is_canonical = FALSE
       WHERE chain_id = $1 AND block_number > $2;`,
      [chainId, ancestorNumber]
    );

    await client.query(
      `UPDATE journal_events SET is_canonical = FALSE
       WHERE chain_id = $1 AND block_number > $2;`,
      [chainId, ancestorNumber]
    );

    // 2. Replay all canonical projections
    await this._rebuildProjectionsFromCanonicalEvents(client, chainId);

    // 3. Update checkpoint to common ancestor
    await client.query(
      `UPDATE indexer_checkpoints SET
        last_indexed_block = $2,
        last_indexed_hash = $3,
        reorg_count = reorg_count + 1,
        updated_at = NOW()
       WHERE chain_id = $1;`,
      [chainId, ancestorNumber, commonAncestorHash]
    );

    // 4. Log outbox event
    await client.query(
      `INSERT INTO outbox_events (sequence_id, event_type, payload)
       VALUES ($1, 'CHAIN_REORG_RESOLVED', $2);`,
      [
        Date.now(),
        JSON.stringify({
          ancestorNumber,
          commonAncestorHash,
          orphanedCount,
        }),
      ]
    );

    return {
      detected: true,
      commonAncestorNumber: ancestorNumber,
      commonAncestorHash,
      orphanedBlockCount: orphanedCount,
      replacementBlockCount: 0,
    };
  }

  private async _rebuildProjectionsFromCanonicalEvents(client: pg.PoolClient, chainId: number): Promise<void> {
    await client.query(`TRUNCATE TABLE projections_ratings CASCADE;`);
    await client.query(`TRUNCATE TABLE projections_reputation CASCADE;`);
    await client.query(`TRUNCATE TABLE projections_liabilities CASCADE;`);
    await client.query(`TRUNCATE TABLE projections_credits CASCADE;`);
    await client.query(`TRUNCATE TABLE projections_milestones CASCADE;`);
    await client.query(`TRUNCATE TABLE projections_projects CASCADE;`);

    const eventsRes = await client.query(
      `SELECT block_number, event_name, payload FROM journal_events
       WHERE chain_id = $1 AND is_canonical = TRUE
       ORDER BY block_number ASC, log_index ASC;`,
      [chainId]
    );

    for (const row of eventsRes.rows) {
      await this.projectionEngine.applyEvent(
        client,
        chainId,
        Number(row.block_number),
        row.event_name,
        row.payload
      );
    }
  }
}
