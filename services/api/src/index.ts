import { createApiServer } from "./server.js";
import { Database } from "@lancechain/indexer";
import { ethers } from "ethers";

export * from "./server.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const DB_URL = process.env.DATABASE_URL || "postgres://localhost:5432/lancechain_dev";
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const CHAIN_ID = process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : 31337;

async function main() {
  const db = new Database(DB_URL);
  await db.migrate();

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const app = createApiServer({ db, provider, chainId: CHAIN_ID });

  app.listen(PORT, () => {
    console.log(`[Lancechain API] Listening on http://localhost:${PORT}`);
  });
}

if (process.argv[1] && process.argv[1].endsWith("index.js")) {
  main().catch((err) => {
    console.error("[Lancechain API] Fatal startup error:", err);
    process.exit(1);
  });
}
