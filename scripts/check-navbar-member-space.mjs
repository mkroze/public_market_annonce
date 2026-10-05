import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(join(__dirname, "..", "frontend", "src", "App.tsx"), "utf8");
const navbarSource = readFileSync(join(__dirname, "..", "frontend", "src", "components", "Navbar.tsx"), "utf8");

if (!appSource.includes('path="/alerts"') || !appSource.includes("<RequireAuth>")) {
  throw new Error("Expected /alerts to exist as an authenticated member route.");
}

const memberSpaceLinks = [...navbarSource.matchAll(/<Link\s+to="\/alerts"[^>]*>\s*<UserRound\s+size=\{14\}\s*\/>\s*Espace membre\s*<\/Link>/g)];

if (memberSpaceLinks.length < 2) {
  throw new Error("Expected desktop and mobile account dropdowns to link to the member space.");
}

console.log("Navbar exposes the authenticated member space in account dropdowns.");
