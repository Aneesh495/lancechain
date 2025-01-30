#!/usr/bin/env bash
set -euo pipefail

export ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ACCEPTANCE_FILE="$ROOT_DIR/ACCEPTANCE.json"

if [ ! -f "$ACCEPTANCE_FILE" ]; then
  echo "Error: ACCEPTANCE.json does not exist. Run scripts/run_acceptance.sh first."
  exit 1
fi

python3 - << 'EOF'
import os
import json
import sys

root = os.environ.get("ROOT_DIR", os.path.abspath("."))
path = os.path.join(root, "ACCEPTANCE.json")

try:
    with open(path, "r") as f:
        data = json.load(f)
except Exception as e:
    print(f"Error parsing ACCEPTANCE.json: {e}")
    sys.exit(1)

expected_gates = [
    "gate_1_clean_architecture",
    "gate_2_contracts_unit",
    "gate_3_contracts_invariants",
    "gate_4_differential_model",
    "gate_5_sdk_complete",
    "gate_6_indexer_reorg",
    "gate_7_api_service",
    "gate_8_web_marketplace",
    "gate_9_financial_invariants",
    "gate_10_high_throughput_benchmark"
]

all_passed = True
print("Verifying ACCEPTANCE.json gates:")
for gate in expected_gates:
    info = data.get("gates", {}).get(gate, {})
    status = info.get("status")
    if status == "PASSED":
        print(f"  [PASS] {gate}")
    else:
        print(f"  [FAIL] {gate} - status is {status}")
        all_passed = False

loc_summary = data.get("substantive_loc_summary", {})
total_loc = loc_summary.get("total_production_loc", 0)
print(f"\nSubstantive LOC: {total_loc} (minimum: 10,000, target: 12,000 - 17,000)")
if total_loc < 10000:
    print(f"  [FAIL] Substantive LOC below hard minimum 10,000!")
    all_passed = False
else:
    print(f"  [PASS] Substantive LOC requirement satisfied.")

if not all_passed:
    sys.exit(1)

print("\nVerification successful: All 10 acceptance criteria verified.")
EOF
