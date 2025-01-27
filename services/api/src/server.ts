import express, { Express } from "express";
import cors from "cors";
import { Database, ReconciliationEngine } from "@lancechain/indexer";
import { ethers } from "ethers";
import { createStatusRouter } from "./routes/status.js";
import { createProjectsRouter } from "./routes/projects.js";
import { createAccountsRouter } from "./routes/accounts.js";
import { createReputationRouter } from "./routes/reputation.js";
import { createLiabilitiesRouter } from "./routes/liabilities.js";
import { createReconciliationRouter } from "./routes/reconciliation.js";
import { createEventsRouter } from "./routes/events.js";

export interface ApiServerOptions {
  db: Database;
  reconciliationEngine?: ReconciliationEngine;
  provider?: ethers.Provider;
  chainId?: number;
}

export function createApiServer(options: ApiServerOptions): Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api", createStatusRouter(options.db, options.provider, options.chainId ?? 31337));
  app.use("/api/projects", createProjectsRouter(options.db));
  app.use("/api/accounts", createAccountsRouter(options.db));
  app.use("/api/reputation", createReputationRouter(options.db));
  app.use("/api/liabilities", createLiabilitiesRouter(options.db));
  app.use("/api/events", createEventsRouter(options.db));

  if (options.reconciliationEngine) {
    app.use("/api/reconcile", createReconciliationRouter(options.reconciliationEngine, options.chainId ?? 31337));
    app.use("/api/reconciliation", createReconciliationRouter(options.reconciliationEngine, options.chainId ?? 31337));
  }

  return app;
}
