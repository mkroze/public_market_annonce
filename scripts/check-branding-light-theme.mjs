import { existsSync, readFileSync } from "node:fs";

const navbarSource = readFileSync("frontend/src/components/Navbar.tsx", "utf8");
const cssSource = readFileSync("frontend/src/index.css", "utf8");
const droppedLogo = readFileSync("frontend/public/logo-full.svg", "utf8");
const navbarLogo = readFileSync("frontend/src/assets/logo-full.svg", "utf8");
const favicon = readFileSync("frontend/public/favicon.svg", "utf8");

const forbiddenNavbarSnippets = [
  "logo-full-reversed",
  "setDark",
  "localStorage.getItem(\"theme\")",
  "localStorage.setItem(\"theme\")",
  "academic-dark",
  "Passer en mode sombre",
  "Passer en mode clair",
  "Mode sombre",
  "Mode clair",
];

const forbiddenImports = ["Sun", "Moon", "useEffect"];

const remainingDarkModeCode = forbiddenNavbarSnippets.filter((snippet) =>
  navbarSource.includes(snippet),
);
const remainingDarkModeImports = forbiddenImports.filter((name) =>
  new RegExp(`\\b${name}\\b`).test(navbarSource),
);

if (remainingDarkModeCode.length > 0 || remainingDarkModeImports.length > 0) {
  throw new Error(
    `Navbar still contains dark-mode code: ${[
      ...remainingDarkModeCode,
      ...remainingDarkModeImports,
    ].join(", ")}`,
  );
}

if (!navbarSource.includes("h-16")) {
  throw new Error("Navbar row should return to the compact height for the cropped half-size logo.");
}

if (!navbarSource.includes("h-4") || !navbarSource.includes("sm:h-4")) {
  throw new Error("Navbar logo should render at the requested h-4 size.");
}

if (navbarSource.includes("h-9") || navbarSource.includes("sm:h-10")) {
  throw new Error("Navbar logo should not keep the previous h-9/sm:h-10 size.");
}

if (cssSource.includes("academic-dark")) {
  throw new Error("Stylesheet still defines or references the dark academic theme.");
}

if (existsSync("frontend/src/assets/logo-full-reversed.svg")) {
  throw new Error("Obsolete dark-mode navbar logo asset should be removed.");
}

if (!navbarLogo.includes('viewBox="617 524 376 323"')) {
  throw new Error("Navbar logo SVG should be cropped to the visible mark bounds.");
}

const requiredLogoColors = ["#00236F", "#1E3A8A", "#F59E0B", "#151C27"];
const missingLogoColors = requiredLogoColors.filter((color) => !navbarLogo.includes(color));

if (missingLogoColors.length > 0) {
  throw new Error(`Navbar logo should use the site palette. Missing: ${missingLogoColors.join(", ")}`);
}

if (navbarLogo.includes('fill="#000000"')) {
  throw new Error("Navbar logo should not remain monochrome black.");
}

if (navbarLogo !== droppedLogo) {
  throw new Error("Navbar logo asset must match frontend/public/logo-full.svg.");
}

if (favicon !== droppedLogo) {
  throw new Error("Favicon must match frontend/public/logo-full.svg.");
}

console.log("Branding uses the dropped logo and the navbar has no dark-mode toggle.");
