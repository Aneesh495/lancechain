#!/usr/bin/env bash
set -euo pipefail

export ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="$ROOT_DIR/.verification"
mkdir -p "$OUTPUT_DIR"

echo "=== Generating Foundry Gas Profiling Report ==="
cd "$ROOT_DIR/packages/contracts"
forge test --match-path "test/LancechainEscrow.t.sol" --gas-report > "$OUTPUT_DIR/gas_report.txt"

# Extract JSON summary
python3 - << 'EOF'
import os
import re
import json
import datetime

root = os.environ.get("ROOT_DIR", os.path.abspath("."))
txt_path = os.path.join(root, ".verification", "gas_report.txt")
json_path = os.path.join(root, ".verification", "gas_report.json")

report = {
    "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "methods": {}
}

if os.path.exists(txt_path):
    with open(txt_path, "r") as f:
        content = f.read()

    pattern = re.compile(r"\|\s*([a-zA-Z0-9_]+)\s*\|\s*([0-9]+)\s*\|\s*([0-9]+)\s*\|\s*([0-9]+)\s*\|\s*([0-9]+)\s*\|\s*([0-9]+)\s*\|")
    for match in pattern.finditer(content):
        method, g_min, g_avg, g_med, g_max, calls = match.groups()
        report["methods"][method] = {
            "min": int(g_min),
            "avg": int(g_avg),
            "median": int(g_med),
            "max": int(g_max),
            "calls": int(calls)
        }

with open(json_path, "w") as f:
    json.dump(report, f, indent=2)

print(f"Gas report written to {json_path}")
print(f"Profiled {len(report['methods'])} contract methods.")
EOF

cat "$OUTPUT_DIR/gas_report.txt"
