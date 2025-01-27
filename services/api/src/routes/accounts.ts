import { Router, Request, Response } from "express";
import { Database } from "@lancechain/indexer";

export function createAccountsRouter(db: Database): Router {
  const router = Router();

  router.get("/:address/credits", async (req: Request, res: Response) => {
    try {
      const { address } = req.params;
      const credits = await db.query(
        `SELECT token, credit_balance, total_withdrawn, last_updated_block
         FROM projections_credits
         WHERE LOWER(account) = LOWER($1);`,
        [address]
      );
      res.json({ account: address.toLowerCase(), credits });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
