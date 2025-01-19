SHELL := /bin/bash
.PHONY: all bootstrap dev demo test test-invariants test-differential test-integration test-e2e gas-report benchmark acceptance verify clean census

all: bootstrap test

bootstrap:
	@echo "==> Bootstrapping Lancechain Protocol dependencies..."
	npm install
	@if [ -d packages/contracts ]; then (cd packages/contracts && forge install --no-git OpenZeppelin/openzeppelin-contracts@v5.0.2 2>/dev/null || true); fi
	@echo "==> Bootstrap complete."

dev:
	@echo "==> Starting local development services..."
	./scripts/dev.sh

demo:
	@echo "==> Launching end-to-end local demo environment..."
	./scripts/demo.sh

test:
	@echo "==> Running core protocol unit and integration tests..."
	./scripts/test_unit.sh

test-invariants:
	@echo "==> Running stateful property and invariant campaign..."
	./scripts/test_invariants.sh

test-differential:
	@echo "==> Running differential reference model verification campaign..."
	./scripts/test_differential.sh

test-integration:
	@echo "==> Running cross-module integration tests..."
	./scripts/test_integration.sh

test-e2e:
	@echo "==> Running end-to-end browser and RPC tests..."
	./scripts/test_e2e.sh

gas-report:
	@echo "==> Generating gas consumption profile and benchmark report..."
	./scripts/gas_report.sh

benchmark:
	@echo "==> Running performance and indexer throughput benchmark..."
	./scripts/benchmark.sh

acceptance:
	@echo "==> Executing full verification suite and generating ACCEPTANCE.json..."
	./scripts/run_acceptance.sh

verify:
	@echo "==> Verifying existing acceptance artifacts without regeneration..."
	./scripts/verify_acceptance.sh

census:
	@python3 scripts/census.py

clean:
	@echo "==> Cleaning build artifacts and cache..."
	rm -rf out cache dist packages/*/dist services/*/dist apps/web/dist
