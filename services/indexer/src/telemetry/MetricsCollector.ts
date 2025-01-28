export interface IndexerMetricsSnapshot {
  blocksProcessedTotal: number;
  eventsProcessedTotal: number;
  reorgsDetectedTotal: number;
  reorgBlocksUnwoundTotal: number;
  lastIndexedBlockNumber: number;
  averageBlockProcessingTimeMs: number;
  errorCountTotal: number;
  uptimeSeconds: number;
  timestamp: string;
}

export class MetricsCollector {
  private blocksProcessed = 0;
  private eventsProcessed = 0;
  private reorgsDetected = 0;
  private reorgBlocksUnwound = 0;
  private lastIndexedBlock = 0;
  private totalProcessingTimeMs = 0;
  private errorCount = 0;
  private startTime = Date.now();

  public recordBlockProcessed(blockNumber: number, durationMs: number, eventCount: number): void {
    this.blocksProcessed += 1;
    this.eventsProcessed += eventCount;
    this.lastIndexedBlock = Math.max(this.lastIndexedBlock, blockNumber);
    this.totalProcessingTimeMs += durationMs;
  }

  public recordReorg(blocksUnwound: number): void {
    this.reorgsDetected += 1;
    this.reorgBlocksUnwound += blocksUnwound;
  }

  public recordError(): void {
    this.errorCount += 1;
  }

  public getSnapshot(): IndexerMetricsSnapshot {
    const avgTime =
      this.blocksProcessed > 0
        ? Math.round(this.totalProcessingTimeMs / this.blocksProcessed)
        : 0;

    return {
      blocksProcessedTotal: this.blocksProcessed,
      eventsProcessedTotal: this.eventsProcessed,
      reorgsDetectedTotal: this.reorgsDetected,
      reorgBlocksUnwoundTotal: this.reorgBlocksUnwound,
      lastIndexedBlockNumber: this.lastIndexedBlock,
      averageBlockProcessingTimeMs: avgTime,
      errorCountTotal: this.errorCount,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
    };
  }

  public reset(): void {
    this.blocksProcessed = 0;
    this.eventsProcessed = 0;
    this.reorgsDetected = 0;
    this.reorgBlocksUnwound = 0;
    this.lastIndexedBlock = 0;
    this.totalProcessingTimeMs = 0;
    this.errorCount = 0;
    this.startTime = Date.now();
  }
}
