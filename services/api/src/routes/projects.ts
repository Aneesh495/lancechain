import { Router, Request, Response } from "express";
import { Database } from "@lancechain/indexer";

export function createProjectsRouter(db: Database): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response) => {
    try {
      const { client, freelancer, token, isSettled, limit = "50", offset = "0" } = req.query;

      let query = `SELECT * FROM projections_projects WHERE 1=1`;
      const params: unknown[] = [];
      let idx = 1;

      if (client && typeof client === "string") {
        query += ` AND LOWER(client) = LOWER($${idx++})`;
        params.push(client);
      }
      if (freelancer && typeof freelancer === "string") {
        query += ` AND LOWER(freelancer) = LOWER($${idx++})`;
        params.push(freelancer);
      }
      if (token && typeof token === "string") {
        query += ` AND LOWER(token) = LOWER($${idx++})`;
        params.push(token);
      }
      if (isSettled !== undefined) {
        query += ` AND is_settled = $${idx++}`;
        params.push(isSettled === "true");
      }

      query += ` ORDER BY created_at_block DESC LIMIT $${idx++} OFFSET $${idx++};`;
      params.push(Math.min(100, Math.max(1, Number(limit))), Math.max(0, Number(offset)));

      const projects = await db.query(query, params);
      res.json({ projects, count: projects.length });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.get("/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const projRows = await db.query<Record<string, unknown>>(
        `SELECT * FROM projections_projects WHERE project_id = $1;`,
        [id]
      );


      if (projRows.length === 0) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      const project = projRows[0];
      const milestones = await db.query(
        `SELECT * FROM projections_milestones WHERE project_id = $1 ORDER BY milestone_index ASC;`,
        [id]
      );

      res.json({ ...project, milestones });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.get("/:id/events", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const events = await db.query(
        `SELECT id, block_number, block_hash, tx_hash, log_index, event_name, payload, created_at
         FROM journal_events
         WHERE project_id = $1 AND is_canonical = TRUE
         ORDER BY block_number ASC, log_index ASC;`,
        [id]
      );

      res.json({ projectId: id, events, count: events.length });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
