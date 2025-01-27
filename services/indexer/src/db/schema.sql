-- Lancechain Database Schema: Journal and Projections

CREATE TABLE IF NOT EXISTS indexer_checkpoints (
    chain_id INT PRIMARY KEY,
    deployment_id TEXT NOT NULL,
    last_indexed_block BIGINT NOT NULL,
    last_indexed_hash TEXT NOT NULL,
    reorg_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_blocks (
    chain_id INT NOT NULL,
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    parent_hash TEXT NOT NULL,
    block_timestamp BIGINT NOT NULL,
    is_canonical BOOLEAN NOT NULL DEFAULT TRUE,
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (chain_id, block_hash)
);

CREATE INDEX IF NOT EXISTS idx_journal_blocks_canonical ON journal_blocks(chain_id, block_number, is_canonical);

CREATE TABLE IF NOT EXISTS journal_events (
    id BIGSERIAL PRIMARY KEY,
    chain_id INT NOT NULL,
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    tx_hash TEXT NOT NULL,
    log_index INT NOT NULL,
    event_name TEXT NOT NULL,
    project_id TEXT,
    payload JSONB NOT NULL,
    is_canonical BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(chain_id, block_hash, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_journal_events_project ON journal_events(project_id, is_canonical);
CREATE INDEX IF NOT EXISTS idx_journal_events_block ON journal_events(chain_id, block_number, is_canonical);

CREATE TABLE IF NOT EXISTS projections_projects (
    project_id TEXT PRIMARY KEY,
    client TEXT NOT NULL,
    freelancer TEXT NOT NULL,
    token TEXT NOT NULL,
    total_budget NUMERIC NOT NULL,
    dispute_window INT NOT NULL,
    quorum_threshold INT NOT NULL,
    timeout_policy INT NOT NULL,
    fee_bps INT NOT NULL,
    fee_recipient TEXT NOT NULL,
    agreement_hash TEXT NOT NULL,
    milestone_count INT NOT NULL,
    active_milestone_index INT NOT NULL DEFAULT 0,
    is_settled BOOLEAN NOT NULL DEFAULT FALSE,
    last_updated_block BIGINT NOT NULL,
    created_at_block BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS projections_milestones (
    project_id TEXT NOT NULL REFERENCES projections_projects(project_id) ON DELETE CASCADE,
    milestone_index INT NOT NULL,
    state INT NOT NULL,
    amount NUMERIC NOT NULL,
    delivery_deadline BIGINT NOT NULL,
    review_deadline BIGINT NOT NULL DEFAULT 0,
    dispute_timeout BIGINT NOT NULL DEFAULT 0,
    review_period INT NOT NULL,
    max_revisions INT NOT NULL,
    revisions_used INT NOT NULL DEFAULT 0,
    dispute_round INT NOT NULL DEFAULT 0,
    deliverable_hash TEXT NOT NULL DEFAULT '',
    revision_reason_hash TEXT NOT NULL DEFAULT '',
    dispute_reason_hash TEXT NOT NULL DEFAULT '',
    last_updated_block BIGINT NOT NULL,
    PRIMARY KEY (project_id, milestone_index)
);

CREATE TABLE IF NOT EXISTS projections_credits (
    account TEXT NOT NULL,
    token TEXT NOT NULL,
    credit_balance NUMERIC NOT NULL DEFAULT 0,
    total_withdrawn NUMERIC NOT NULL DEFAULT 0,
    last_updated_block BIGINT NOT NULL,
    PRIMARY KEY (account, token)
);

CREATE TABLE IF NOT EXISTS projections_liabilities (
    token TEXT PRIMARY KEY,
    escrow_liability NUMERIC NOT NULL DEFAULT 0,
    credit_liability NUMERIC NOT NULL DEFAULT 0,
    total_liability NUMERIC NOT NULL DEFAULT 0,
    last_updated_block BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS projections_reputation (
    account TEXT PRIMARY KEY,
    total_projects INT NOT NULL DEFAULT 0,
    completed_count INT NOT NULL DEFAULT 0,
    disputed_count INT NOT NULL DEFAULT 0,
    timeout_count INT NOT NULL DEFAULT 0,
    refund_count INT NOT NULL DEFAULT 0,
    rating_count INT NOT NULL DEFAULT 0,
    total_rating_stars BIGINT NOT NULL DEFAULT 0,
    last_updated_block BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS projections_ratings (
    id BIGSERIAL PRIMARY KEY,
    project_id TEXT NOT NULL,
    rater TEXT NOT NULL,
    ratee TEXT NOT NULL,
    score INT NOT NULL,
    feedback_hash TEXT NOT NULL,
    block_number BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outbox_events (
    id BIGSERIAL PRIMARY KEY,
    sequence_id BIGINT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
