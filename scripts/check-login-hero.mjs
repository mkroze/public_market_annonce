import { readFileSync } from "node:fs";

const source = readFileSync("frontend/src/pages/Login.tsx", "utf8");

const requiredSnippets = [
  'import logoFull from "../assets/logo-full.svg";',
  'import logoWhite from "../assets/logo-full-white.svg";',
  "Votre accès simplifié au marché public",
  "Une recherche intuitive, des alertes ciblées et un espace sécurisé pour faciliter chacune de vos consultations.",
  "bg-[var(--color-primary)]",
  "h-48",
  "src={logoWhite}",
  "clipPath",
  "mt-10",
  "mt-4",
  "max-w-[24rem]",
  "max-w-[26rem]",
  "translate-y-8",
  "leading-[1.08]",
  "[text-wrap:balance]",
  "leading-[1.45]",
  "font-sans",
  "Se connecter",
  "Créer un compte",
  'autoComplete="email"',
  'autoComplete="current-password"',
  'aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}',
];

const missing = requiredSnippets.filter((snippet) => !source.includes(snippet));

if (missing.length > 0) {
  throw new Error(`Login hero is missing expected snippets:\n${missing.join("\n")}`);
}

if (source.includes("<Breadcrumbs")) {
  throw new Error("Login hero should not render the old breadcrumb-led centered form layout.");
}

if (source.includes("heroImage")) {
  throw new Error("Login hero should use the blue brand panel, not the previous hero image background.");
}

if (source.includes("maskImage") || source.includes("WebkitMaskImage")) {
  throw new Error("Login hero should render the real white SVG logo, not a CSS mask block.");
}

const staleCopy = [
  "Consultez le catalogue national en toute aisance",
  "Recherche guidée, alertes ciblées et espace sécurisé pour suivre vos consultations sans friction.",
  "Accédez aux consultations, filtrez les opportunités publiques et gardez le fil de vos échéances depuis un seul espace.",
  "Votre accès simplifié au catalogue national",
  "Catalogue national",
];
const staleCopyMatches = staleCopy.filter((snippet) => source.includes(snippet));

if (staleCopyMatches.length > 0) {
  throw new Error(`Login hero still contains stale copy:\n${staleCopyMatches.join("\n")}`);
}

const forbiddenGlassTreatment = ["bg-white/10", "border-white/20", "backdrop-blur"];
const glassMatches = forbiddenGlassTreatment.filter((snippet) => source.includes(snippet));

if (glassMatches.length > 0) {
  throw new Error(`Login hero should not use glass badge treatments:\n${glassMatches.join("\n")}`);
}

if (!source.includes("lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.7fr)]")) {
  throw new Error("Login hero should use a desktop split layout with the form on the side.");
}

console.log("Login page exposes the branded hero and preserves the login form.");
