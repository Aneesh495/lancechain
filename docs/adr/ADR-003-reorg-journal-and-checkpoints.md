# ADR-003: Reorg-Aware Rollback Journal and Checkpoints

Status: Accepted
Date: 2026-10-02
Author: Google Deepmind Antigravity Pair Programmer

## Context
EVM blockchains experience periodic chain reorganizations. Indexers that maintain materialized read projections directly from incoming blocks can end up with corrupted or phantom state if an orphaned block is discarded by the network.

## Decision
We decouple raw event ingestion from projection materialized tables:
1. `journal_blocks` and `journal_events` maintain an append-only transaction ledger with parent hash linkage.
2. When a parent hash mismatch is observed, `ReorgEngine` traces backward to locate the common ancestor up to 128 blocks deep.
3. Orphaned events are marked `reorged = TRUE` and read projections are rolled back and replayed inside a single ACID PostgreSQL transaction.

## Consequences
- Positive: Guaranteed eventual consistency between indexer projections and canonical chain state.
- Positive: Safe against network reorgs and process restarts.
- Tradeoff: Slight database storage overhead to maintain historical block headers and journal event logs.
