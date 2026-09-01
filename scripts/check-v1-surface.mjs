import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Public catalog routes plus the gated admin surface (/admin/*, /login) that the
// launch intentionally keeps. The wrappers /* and /admin/* live in the top-level
// <Routes>, the rest inside the public layout. Static info/legal pages (about,
// contact, faq, /legal/*) are generic boilerplate, not retired catalog features.
const allowedRoutePaths = new Set([
  "/",
  "/tenders",
  "/tenders/:id",
  "/alerts",
  "/login",
  "/register",
  "/about",
  "/contact",
  "/faq",
  "/legal/mentions-legales",
  "/legal/confidentialite",
  "/legal/conditions",
  "/legal/cookies",
  "/admin/*",
  "/*",
  "*",
]);
const allowedNavTargets = new Set(["/", "/tenders", "/alerts", "/about", "/faq", "/contact"]);
// Links to the retired public pages must not reappear. /admin, /login and
// /register are deliberately absent: they are auth entry points, not retired
// catalog pages. /alerts is likewise absent: the signed-in "Mes alertes"
// (triggers) page ships with the launch.
const forbiddenInternalPrefixes = [
  "/assistant",
  "/blog",
  "/calculator",
  "/cities",
  "/eligibility",
  "/favorites",
  "/guide",
  "/partenaires",
  "/pricing",
  "/procedures",
  "/recours",
  "/regions",
  "/sectors",
  "/stats",
];

const appSource = readFileSync("frontend/src/App.tsx", "utf8");
const navbarSource = readFileSync("frontend/src/components/Navbar.tsx", "utf8");

function listTsxFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listTsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

const routePaths = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map(
  ([, path]) => path,
);
const navTargets = [...navbarSource.matchAll(/to:\s*"([^"]+)"/g)].map(
  ([, path]) => path,
);
const forbiddenLinkUses = listTsxFiles("frontend/src").flatMap((file) => {
  const source = readFileSync(file, "utf8");
  const candidates = [
    ...source.matchAll(/to=(?:"([^"]+)"|\{`([^`]+)`\})/g),
    ...source.matchAll(/navigate\((?:"([^"]+)"|`([^`]+)`)/g),
  ];

  return candidates
    .map((match) => match[1] || match[2])
    .filter((target) =>
      forbiddenInternalPrefixes.some((prefix) => target.startsWith(prefix)),
    )
    .map((target) => `${file}: ${target}`);
});

const forbiddenRoutes = routePaths.filter((path) => !allowedRoutePaths.has(path));
const forbiddenNavTargets = navTargets.filter((path) => !allowedNavTargets.has(path));

if (!routePaths.includes("/tenders") || !routePaths.includes("/tenders/:id")) {
  throw new Error("V1 must expose both /tenders and /tenders/:id routes.");
}

if (forbiddenRoutes.length > 0) {
  throw new Error(`Forbidden V1 routes exposed: ${forbiddenRoutes.join(", ")}`);
}

if (forbiddenNavTargets.length > 0) {
  throw new Error(`Forbidden V1 nav targets exposed: ${forbiddenNavTargets.join(", ")}`);
}

if (forbiddenLinkUses.length > 0) {
  throw new Error(`Forbidden V1 in-app links exposed:\n${forbiddenLinkUses.join("\n")}`);
}

console.log("V1 frontend surface only exposes catalog and authenticated member routes.");
