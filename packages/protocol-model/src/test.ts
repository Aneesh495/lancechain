import { DifferentialRunner } from "./DifferentialRunner.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../..");
const outDir = path.join(rootDir, ".verification");

console.log("==> Running Differential Reference Model Campaign (10,000 seeded histories)...");
const runner = new DifferentialRunner(1337);
const report = runner.runCampaign(10000);

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const outPath = path.join(outDir, "differential_report.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`Differential Campaign Summary:`);
console.log(`  - Total Histories: ${report.totalHistories}`);
console.log(`  - Successful Steps: ${report.successfulSteps}`);
console.log(`  - Reverted Steps: ${report.revertedSteps}`);
console.log(`  - Divergence Count: ${report.divergenceCount}`);
console.log(`  - Invariants Preserved: ${report.invariantsPreserved}`);
console.log(`  - Output: ${outPath}`);

if (report.divergenceCount > 0 || !report.invariantsPreserved) {
  console.error("FAIL: Divergence detected between model and invariants!");
  process.exit(1);
} else {
  console.log("PASS: 10,000 differential histories verified with zero divergence.");
}
