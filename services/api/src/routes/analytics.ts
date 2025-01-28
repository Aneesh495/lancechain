import { Router, Request, Response } from "express";
import { Database } from "@lancechain/indexer";

export function createAnalyticsRouter(db: Database): Router {
  const router = Router();

  // GET /api/analytics/summary
  router.get("/summary", async (_req: Request, res: Response) => {
    try {
      const projectsCount = await db.query<{ total_projects: string; settled_projects: string }>(
        "SELECT COUNT(*) AS total_projects, COUNT(*) FILTER (WHERE is_settled = TRUE) AS settled_projects FROM projections_projects;"
      );
      const milestonesCount = await db.query<{ state: number; count_by_state: string }>(
        "SELECT state, COUNT(*) as count_by_state FROM projections_milestones GROUP BY state;"
      );
      const credits = await db.query<{ token: string; total_unclaimed: string }>(
        "SELECT token, SUM(amount::numeric) as total_unclaimed FROM projections_credits WHERE amount > 0 GROUP BY token;"
      );
      const reorgs = await db.query<{ total_reorgs: string }>(
        "SELECT COUNT(*) AS total_reorgs FROM journal_reorgs;"
      );

      res.json({
        projects: projectsCount[0] || { total_projects: "0", settled_projects: "0" },
        milestones: milestonesCount,
        unclaimedCredits: credits,
        reorgsCount: Number(reorgs[0]?.total_reorgs || 0),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/analytics/volume-by-token
  router.get("/volume-by-token", async (_req: Request, res: Response) => {
    try {
      const result = await db.query<{ token: string; project_count: string; total_volume_wei: string }>(
        `SELECT p.token,
                COUNT(p.project_id) as project_count,
                COALESCE(SUM(m.amount::numeric), 0) as total_volume_wei
         FROM projections_projects p
         JOIN projections_milestones m ON p.project_id = m.project_id
         GROUP BY p.token;`
      );

      res.json({
        tokens: result,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // GET /api/analytics/disputes
  router.get("/disputes", async (_req: Request, res: Response) => {
    try {
      const result = await db.query<{
        project_id: string;
        milestone_index: number;
        state: number;
        amount: string;
        client: string;
        freelancer: string;
        token: string;
      }>(
        `SELECT m.project_id,
                m.milestone_index,
                m.state,
                m.amount,
                p.client,
                p.freelancer,
                p.token
         FROM projections_milestones m
         JOIN projections_projects p ON m.project_id = p.project_id
         WHERE m.state = 3 OR m.state = 6;` // 3 = Disputed, 6 = SplitSettled
      );

      res.json({
        disputedCount: result.length,
        disputes: result,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
