import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const filterBarPath = join(__dirname, "..", "frontend", "src", "components", "FilterBar.tsx");
const source = readFileSync(filterBarPath, "utf8");

const expectedPaddedRows = [
  'className="flex items-center justify-between gap-4 border-t border-[var(--color-border-subtle)] px-3 py-3 sm:px-4"',
  'className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border-subtle)] px-3 py-3 sm:px-4"',
  'className="border-t border-[var(--color-border-subtle)] px-5 py-6 space-y-5 sm:px-6 lg:px-8"',
];

const missingRows = expectedPaddedRows.filter((className) => !source.includes(className));

if (missingRows.length > 0) {
  throw new Error(`FilterBar menu rows are missing horizontal padding:\n${missingRows.join("\n")}`);
}

console.log("FilterBar menu rows include horizontal padding.");
