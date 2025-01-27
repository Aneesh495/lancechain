import { ethers } from "ethers";
import { Database } from "../db/Database.js";
import { ProjectionEngine } from "./ProjectionEngine.js";
import { ReorgEngine } from "./ReorgEngine.js";
import { IndexerConfig, Checkpoint } from "../types.js";
import { EventDecoder, DecodedLancechainEvent } from "@lancechain/sdk";

export class BlockSyncer {
  public readonly config: IndexerConfig;
  public readonly db: Database;
  public readonly provider: ethers.Provider;
  public readonly projectionEngine: ProjectionEngine;
  public readonly reorgEngine: ReorgEngine;
  private readonly eventDecoder: EventDecoder;
  private isRunning: boolean = false;

  constructor(config: IndexerConfig, db: Database, provider: ethers.Provider) {
    this.config = config;
    this.db = db;
    this.provider = provider;
    this.projectionEngine = new ProjectionEngine();
    this.reorgEngine = new ReorgEngine(this.projectionEngine, config.maxReorgDepth);
    this.eventDecoder = new EventDecoder();
  }

  public async getOrCreateCheckpoint(): Promise<Checkpoint> {
    const rows = await this.db.query<Checkpoint>(
      `SELECT chain_id as "chainId", deployment_id as "deploymentId",
              last_indexed_block as "lastIndexedBlock", last_indexed_hash as "lastIndexedHash",
              reorg_count as "reorgCount", updated_at as "updatedAt"
       FROM indexer_checkpoints WHERE chain_id = $1;`,
      [this.config.chainId]
    );

    if (rows.length > 0) {
      return {
        ...rows[0],
        lastIndexedBlock: Number(rows[0].lastIndexedBlock),
        reorgCount: Number(rows[0].reorgCount),
      };
    }

    const startBlock = Math.max(0, this.config.startBlock - 1);
    const genesisOrParent = await this.provider.getBlock(startBlock);
    const hash = genesisOrParent?.hash ?? ethers.ZeroHash;

    await this.db.query(
      `INSERT INTO indexer_checkpoints (chain_id, deployment_id, last_indexed_block, last_indexed_hash, reorg_count)
       VALUES ($1, $2, $3, $4, 0);`,
      [this.config.chainId, this.config.deploymentId, startBlock, hash]
    );

    return {
      chainId: this.config.chainId,
      deploymentId: this.config.deploymentId,
      lastIndexedBlock: startBlock,
      lastIndexedHash: hash,
      reorgCount: 0,
      updatedAt: new Date(),
    };

  }

  public async syncOnce(): Promise<{ blocksProcessed: number; eventsProcessed: number }> {
    const checkpoint = await this.getOrCreateCheckpoint();
    const latestChainBlock = await this.provider.getBlockNumber();
    const safeTargetBlock = Math.max(0, latestChainBlock - this.config.confirmations);

    if (checkpoint.lastIndexedBlock >= safeTargetBlock) {
      return { blocksProcessed: 0, eventsProcessed: 0 };
    }

    const fromBlock = checkpoint.lastIndexedBlock + 1;
    const toBlock = Math.min(safeTargetBlock, fromBlock + this.config.batchSize - 1);

    let totalBlocks = 0;
    let totalEvents = 0;

    for (let current = fromBlock; current <= toBlock; current++) {
      const block = await this.provider.getBlock(current);
      if (!block) break;

      const blockLogs = await this.provider.getLogs({
        fromBlock: current,
        toBlock: current,
      });

      // Filter logs for escrow and reputation contracts
      const relevantLogs = blockLogs.filter(
        (l) =>
          l.address.toLowerCase() === this.config.escrowAddress.toLowerCase() ||
          l.address.toLowerCase() === this.config.reputationAddress.toLowerCase()
      );

      await this.db.withTransaction(async (client) => {
        // 1. Detect and resolve reorgs if parentHash doesn't match
        await this.reorgEngine.detectAndResolveReorg(
          client,
          this.provider,
          this.config.chainId,
          block.number,
          block.parentHash
        );

        // 2. Insert block into journal_blocks
        await client.query(
          `INSERT INTO journal_blocks (chain_id, block_number, block_hash, parent_hash, block_timestamp, is_canonical)
           VALUES ($1, $2, $3, $4, $5, TRUE)
           ON CONFLICT (chain_id, block_hash) DO UPDATE SET is_canonical = TRUE;`,
          [this.config.chainId, block.number, block.hash, block.parentHash, block.timestamp]
        );

        // 3. Process logs
        for (const log of relevantLogs) {
          const fakeReceipt = { logs: [log] } as unknown as ethers.ContractTransactionReceipt;
          const decodedList = this.eventDecoder.decodeReceiptEvents(fakeReceipt);

          for (const ev of decodedList) {
            const projectId = "projectId" in ev ? String(ev.projectId) : null;

            await client.query(
              `INSERT INTO journal_events (
                chain_id, block_number, block_hash, tx_hash, log_index, event_name, project_id, payload, is_canonical
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
              ON CONFLICT (chain_id, block_hash, tx_hash, log_index) DO UPDATE SET is_canonical = TRUE;`,
              [
                this.config.chainId,
                block.number,
                block.hash,
                log.transactionHash,
                log.index,
                ev.name,
                projectId,
                JSON.stringify(ev),
              ]
            );

            await this.projectionEngine.applyEvent(
              client,
              this.config.chainId,
              block.number,
              ev.name,
              ev as unknown as Record<string, unknown>
            );

            totalEvents++;
          }
        }

        // 4. Advance checkpoint
        await client.query(
          `UPDATE indexer_checkpoints SET
            last_indexed_block = $2,
            last_indexed_hash = $3,
            updated_at = NOW()
           WHERE chain_id = $1;`,
          [this.config.chainId, block.number, block.hash]
        );

        // 5. Outbox record
        await client.query(
          `INSERT INTO outbox_events (sequence_id, event_type, payload)
           VALUES ($1, 'BLOCK_INDEXED', $2);`,
          [Date.now(), JSON.stringify({ blockNumber: block.number, blockHash: block.hash, eventCount: relevantLogs.length })]
        );
      });

      totalBlocks++;
    }

    return { blocksProcessed: totalBlocks, eventsProcessed: totalEvents };
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    while (this.isRunning) {
      try {
        await this.syncOnce();
      } catch (err) {
        console.error("[BlockSyncer] Sync error:", err);
      }
      await new Promise((r) => setTimeout(r, this.config.pollIntervalMs));
    }
  }

  public stop(): void {
    this.isRunning = false;
  }
}
