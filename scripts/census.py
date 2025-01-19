#!/usr/bin/env python3
"""
Reproducible substantive Lines of Code (LOC) census.
Counts only non-blank, non-comment substantive production code in designated production paths.
Excludes tests, mocks, fixtures, generated files, vendor libraries, configs, and documentation.
Saves private accounting to .verification/census.json.
"""

import os
import sys
import json
import re
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
LEDGER_PATH = ROOT_DIR / ".verification" / "census.json"

MODULE_PATHS = {
    "contracts": ROOT_DIR / "packages" / "contracts" / "src",
    "sdk": ROOT_DIR / "packages" / "sdk" / "src",
    "protocol_model": ROOT_DIR / "packages" / "protocol-model" / "src",
    "indexer": ROOT_DIR / "services" / "indexer" / "src",
    "api": ROOT_DIR / "services" / "api" / "src",
    "web": ROOT_DIR / "apps" / "web" / "src",
}

EXCLUDE_PATTERNS = [
    re.compile(r"(^|[/\\])(test|tests|mocks?|fixtures?|generated|dist|build|out|cache|artifacts|typechain|node_modules)[/\\]", re.IGNORECASE),
    re.compile(r"\.(t\.sol|test\.(ts|js|jsx|tsx)|spec\.(ts|js|jsx|tsx))$", re.IGNORECASE),
    re.compile(r"\.(json|yaml|yml|toml|md|css|scss|svg|png|jpg|ico|map|d\.ts)$", re.IGNORECASE),
]

VALID_EXTENSIONS = {".sol", ".ts", ".tsx", ".js", ".jsx", ".sql"}

def is_substantive_line(line: str, in_multiline_comment: bool) -> tuple[bool, bool]:
    stripped = line.strip()
    if not stripped:
        return False, in_multiline_comment

    if in_multiline_comment:
        if "*/" in stripped:
            after = stripped.split("*/", 1)[1].strip()
            if after and not after.startswith("//"):
                return True, False
            return False, False
        return False, True

    if stripped.startswith("/*"):
        if "*/" in stripped:
            after = stripped.split("*/", 1)[1].strip()
            if after and not after.startswith("//"):
                return True, False
            return False, False
        return False, True

    if stripped.startswith("//") or stripped.startswith("#") or stripped.startswith("*"):
        return False, False

    return True, False

def count_file(filepath: Path) -> int:
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
    except Exception:
        return 0

    count = 0
    in_multi = False
    for line in lines:
        substantive, in_multi = is_substantive_line(line, in_multi)
        if substantive:
            count += 1
    return count

def run_census():
    results = {
        "modules": {},
        "files": {},
        "total_substantive_loc": 0,
        "timestamp": None,
    }

    import datetime
    results["timestamp"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

    grand_total = 0

    for module_name, base_path in MODULE_PATHS.items():
        module_total = 0
        file_counts = {}

        if base_path.exists():
            for root, _, files in os.walk(base_path):
                for f in files:
                    full_path = Path(root) / f
                    rel_to_root = str(full_path.relative_to(ROOT_DIR))

                    if full_path.suffix not in VALID_EXTENSIONS:
                        continue

                    # Check excludes
                    if any(pat.search(rel_to_root) for pat in EXCLUDE_PATTERNS):
                        continue

                    loc = count_file(full_path)
                    if loc > 0:
                        file_counts[rel_to_root] = loc
                        module_total += loc

        results["modules"][module_name] = {
            "substantive_loc": module_total,
            "file_count": len(file_counts),
        }
        results["files"].update(file_counts)
        grand_total += module_total

    results["total_substantive_loc"] = grand_total

    LEDGER_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(LEDGER_PATH, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    # Print summary to stdout when invoked directly
    print(f"Census complete. Substantive production LOC: {grand_total}")
    for mod, data in results["modules"].items():
        print(f"  - {mod}: {data['substantive_loc']} LOC across {data['file_count']} files")
    print(f"Recorded in {LEDGER_PATH.relative_to(ROOT_DIR)}")

if __name__ == "__main__":
    run_census()
