import { Router, Request, Response } from "express";
import { Database } from "@lancechain/indexer";

export function createExportRouter(db: Database): Router {
  const router = Router();

  // GET /api/export/projects.csv
  router.get("/projects.csv", async (_req: Request, res: Response) => {
    try {
      const result = await db.query<{
        project_id: string;
        client: string;
        freelancer: string;
        token: string;
        is_settled: boolean;
        fee_bps: number;
        created_at_block: string;
      }>(
        "SELECT project_id, client, freelancer, token, is_settled, fee_bps, created_at_block FROM projections_projects ORDER BY created_at_block DESC;"
      );

      const header = "project_id,client,freelancer,token,is_settled,fee_bps,created_at_block\n";
      const rows = result
        .map(
          (r) =>
            `${r.project_id},${r.client},${r.freelancer},${r.token},${r.is_settled},${r.fee_bps},${r.created_at_block}`
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", 'attachment; filename="lancechain_projects.csv"');
      res.send(header + rows);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/export/events.json
  router.get("/events.json", async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit || 500), 2000);
      const result = await db.query<Record<string, unknown>>(
        "SELECT * FROM journal_events WHERE reorged = FALSE ORDER BY block_number DESC, log_index DESC LIMIT $1;",
        [limit]
      );

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", 'attachment; filename="lancechain_events.json"');
      res.json({
        total: result.length,
        events: result,
        exportedAt: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
