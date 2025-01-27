export interface BlockHeader {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
}

export interface RawLog {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  blockHash: string;
  transactionHash: string;
  logIndex: number;
}

export interface Checkpoint {
  chainId: number;
  deploymentId: string;
  lastIndexedBlock: number;
  lastIndexedHash: string;
  reorgCount: number;
  updatedAt: Date;
}

export interface IndexerConfig {
  rpcUrl: string;
  databaseUrl: string;
  escrowAddress: string;
  reputationAddress: string;
  chainId: number;
  deploymentId: string;
  batchSize: number;
  maxReorgDepth: number;
  pollIntervalMs: number;
  startBlock: number;
  confirmations: number;
}

export interface ReorgResolution {
  detected: boolean;
  commonAncestorNumber: number;
  commonAncestorHash: string;
  orphanedBlockCount: number;
  replacementBlockCount: number;
}

export interface ReconciliationReport {
  blockNumber: number;
  blockHash: string;
  passed: boolean;
  mismatches: Array<{
    category: "liability" | "project" | "milestone" | "credit" | "reputation";
    identifier: string;
    expectedOnChain: unknown;
    actualProjected: unknown;
  }>;
  timestamp: string;
}
