import { Router, Request, Response } from "express";
import { Database } from "@lancechain/indexer";

export function createEventsRouter(db: Database): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response) => {
    try {
      const { limit = "50", afterId = "0" } = req.query;
      const events = await db.query(
        `SELECT id, chain_id, block_number, block_hash, tx_hash, log_index, event_name, project_id, payload, created_at
         FROM journal_events
         WHERE id > $1 AND is_canonical = TRUE
         ORDER BY id ASC LIMIT $2;`,
        [Number(afterId), Math.min(200, Math.max(1, Number(limit)))]
      );
      res.json({ events, count: events.length });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.get("/stream", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let lastId = 0;
    const interval = setInterval(async () => {
      try {
        const rows = await db.query<{ id: number; event_name: string; payload: unknown }>(
          `SELECT id, event_name, payload FROM journal_events
           WHERE id > $1 AND is_canonical = TRUE
           ORDER BY id ASC LIMIT 20;`,
          [lastId]
        );
        for (const row of rows) {
          lastId = row.id;
          res.write(`data: ${JSON.stringify(row)}\n\n`);
        }
      } catch {
        // Ignore loop query error on close
      }
    }, 1000);

    req.on("close", () => {
      clearInterval(interval);
    });
  });

  return router;
}
