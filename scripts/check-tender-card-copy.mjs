import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tenderCardPath = join(__dirname, "..", "frontend", "src", "components", "TenderCard.tsx");
const source = readFileSync(tenderCardPath, "utf8");

const expectedFallback = 'tender.estimation || "Caution provisoire"';

if (!source.includes(expectedFallback)) {
  throw new Error(`Tender card fallback should use ${expectedFallback}.`);
}

if (source.includes("Budget à vérifier")) {
  throw new Error('Tender card should not display "Budget à vérifier".');
}
