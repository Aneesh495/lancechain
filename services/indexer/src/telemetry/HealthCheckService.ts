import { Database } from "../db/Database.js";
import { ethers } from "ethers";

export interface HealthCheckResult {
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  dbConnected: boolean;
  dbLatencyMs: number;
  rpcConnected: boolean;
  rpcLatencyMs: number;
  chainHeadBlock: number;
  indexedHeadBlock: number;
  blockLag: number;
  timestamp: string;
}

export class HealthCheckService {
  private db: Database;
  private provider?: ethers.Provider;
  private maxAcceptableLag: number;

  constructor(db: Database, provider?: ethers.Provider, maxAcceptableLag = 64) {
    this.db = db;
    this.provider = provider;
    this.maxAcceptableLag = maxAcceptableLag;
  }

  public async checkHealth(): Promise<HealthCheckResult> {
    let dbConnected = false;
    let dbLatencyMs = -1;
    let rpcConnected = false;
    let rpcLatencyMs = -1;
    let chainHeadBlock = 0;
    let indexedHeadBlock = 0;

    // 1. Check PostgreSQL Database
    const dbStart = Date.now();
    try {
      const res = await this.db.query<{ current_block: string }>(
        "SELECT MAX(block_number) as current_block FROM journal_blocks;"
      );
      dbLatencyMs = Date.now() - dbStart;
      dbConnected = true;
      indexedHeadBlock = Number(res[0]?.current_block || 0);
    } catch {
      dbConnected = false;
      dbLatencyMs = Date.now() - dbStart;
    }

    // 2. Check EVM JSON-RPC Provider
    if (this.provider) {
      const rpcStart = Date.now();
      try {
        chainHeadBlock = await this.provider.getBlockNumber();
        rpcLatencyMs = Date.now() - rpcStart;
        rpcConnected = true;
      } catch {
        rpcConnected = false;
        rpcLatencyMs = Date.now() - rpcStart;
      }
    } else {
      rpcConnected = true;
      chainHeadBlock = indexedHeadBlock;
    }

    const blockLag = Math.max(0, chainHeadBlock - indexedHeadBlock);

    let status: HealthCheckResult["status"] = "HEALTHY";
    if (!dbConnected) {
      status = "UNHEALTHY";
    } else if (!rpcConnected || blockLag > this.maxAcceptableLag) {
      status = "DEGRADED";
    }

    return {
      status,
      dbConnected,
      dbLatencyMs,
      rpcConnected,
      rpcLatencyMs,
      chainHeadBlock,
      indexedHeadBlock,
      blockLag,
      timestamp: new Date().toISOString(),
    };
  }
}
