import { Router, Request, Response } from "express";
import { Database } from "@lancechain/indexer";

export function createLiabilitiesRouter(db: Database): Router {
  const router = Router();

  router.get("/", async (_req: Request, res: Response) => {
    try {
      const liabilities = await db.query(
        `SELECT token, escrow_liability, credit_liability, total_liability, last_updated_block
         FROM projections_liabilities;`
      );
      res.json({ liabilities });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
