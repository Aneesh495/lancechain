import { Router, Request, Response } from "express";
import { ReconciliationEngine } from "@lancechain/indexer";

export function createReconciliationRouter(reconciliationEngine: ReconciliationEngine, chainId: number = 31337): Router {
  const router = Router();

  router.get("/", async (_req: Request, res: Response) => {
    try {
      const report = await reconciliationEngine.reconcile(chainId);
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.post("/", async (_req: Request, res: Response) => {
    try {
      const report = await reconciliationEngine.reconcile(chainId);
      res.json(report);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
