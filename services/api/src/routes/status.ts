import { Router, Request, Response } from "express";
import { Database } from "@lancechain/indexer";
import { ethers } from "ethers";

export function createStatusRouter(db: Database, provider?: ethers.Provider, chainId: number = 31337): Router {
  const router = Router();

  router.get("/health", async (_req: Request, res: Response) => {
    try {
      await db.query("SELECT 1;");
      res.json({ status: "healthy", timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(503).json({ status: "unhealthy", error: String(err) });
    }
  });

  router.get("/status", async (_req: Request, res: Response) => {
    try {
      const cpRows = await db.query<{
        last_indexed_block: number;
        last_indexed_hash: string;
        reorg_count: number;
        updated_at: string;
      }>(
        `SELECT last_indexed_block, last_indexed_hash, reorg_count, updated_at
         FROM indexer_checkpoints WHERE chain_id = $1;`,
        [chainId]
      );

      let latestChainBlock = 0;
      if (provider) {
        try {
          latestChainBlock = await provider.getBlockNumber();
        } catch {
          // Provider query failed
        }
      }

      const checkpoint = cpRows.length > 0 ? cpRows[0] : null;
      const lastIndexedBlock = checkpoint ? Number(checkpoint.last_indexed_block) : 0;
      const lagBlocks = Math.max(0, latestChainBlock - lastIndexedBlock);

      res.json({
        chainId,
        healthy: true,
        headBlock: latestChainBlock,
        lastIndexedBlock,
        lastIndexedHash: checkpoint?.last_indexed_hash ?? ethers.ZeroHash,
        indexerLagBlocks: lagBlocks,
        reorgCount: checkpoint ? Number(checkpoint.reorg_count) : 0,
        checkpointUpdatedAt: checkpoint?.updated_at ?? null,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
