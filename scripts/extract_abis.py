#!/usr/bin/env python3
"""
Extracts canonical ABIs and bytecode hashes from compiled contract artifacts into packages/sdk/src/abi.
"""

import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
CONTRACTS_OUT = ROOT_DIR / "packages" / "contracts" / "out"
SDK_ABI_DIR = ROOT_DIR / "packages" / "sdk" / "src" / "abi"

SDK_ABI_DIR.mkdir(parents=True, exist_ok=True)

CONTRACTS = {
    "LancechainEscrow": CONTRACTS_OUT / "LancechainEscrow.sol" / "LancechainEscrow.json",
    "LancechainReputation": CONTRACTS_OUT / "LancechainReputation.sol" / "LancechainReputation.json",
    "MockERC20": CONTRACTS_OUT / "MockERC20.sol" / "MockERC20.json",
}

for name, json_path in CONTRACTS.items():
    if not json_path.exists():
        print(f"Skipping {name}: {json_path} does not exist")
        continue

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    abi = data.get("abi", [])
    bytecode = data.get("bytecode", {}).get("object", "")
    deployed_bytecode = data.get("deployedBytecode", {}).get("object", "")

    ts_content = f"""// Auto-generated from Foundry build artifacts. Do not edit directly.
export const {name}Abi = {json.dumps(abi, indent=2)} as const;
export const {name}Bytecode = "{bytecode}";
export const {name}DeployedBytecode = "{deployed_bytecode}";
"""
    out_file = SDK_ABI_DIR / f"{name}Abi.ts"
    with open(out_file, "w", encoding="utf-8") as out_f:
        out_f.write(ts_content)
    print(f"Extracted {name} ABI to {out_file.relative_to(ROOT_DIR)}")

# Create index.ts in abi
index_ts = """export * from "./LancechainEscrowAbi.js";
export * from "./LancechainReputationAbi.js";
export * from "./MockERC20Abi.js";
"""
with open(SDK_ABI_DIR / "index.ts", "w", encoding="utf-8") as f:
    f.write(index_ts)
print("Generated abi/index.ts")
