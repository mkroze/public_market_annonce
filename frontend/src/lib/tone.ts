import type { GuidanceTone } from "./tenderGuidance";

/**
 * Classes de tons centralisées (badges + panneaux d'aide à la décision).
 * Elles s'appuient sur les tokens --color-tone-* définis dans index.css, qui
 * possèdent une variante mode sombre — contrairement aux anciennes couleurs
 * Tailwind codées en dur (emerald/amber/red) qui juraient sur fond sombre.
 */

// Petit badge coloré (texte de la couleur du ton).
export const TONE_BADGE: Record<GuidanceTone, string> = {
  positive: "border-[var(--color-tone-positive)] bg-[var(--color-tone-positive-soft)] text-[var(--color-tone-positive)]",
  warning: "border-[var(--color-tone-warning)] bg-[var(--color-tone-warning-soft)] text-[var(--color-tone-warning)]",
  critical: "border-[var(--color-tone-critical)] bg-[var(--color-tone-critical-soft)] text-[var(--color-tone-critical)]",
  neutral: "border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] text-[var(--color-slate)]",
};

// Panneau multi-lignes : bordure/fond colorés mais texte neutre pour la lisibilité.
export const TONE_PANEL: Record<GuidanceTone, string> = {
  positive: "border-[var(--color-tone-positive)] bg-[var(--color-tone-positive-soft)] text-[var(--color-charcoal)]",
  warning: "border-[var(--color-tone-warning)] bg-[var(--color-tone-warning-soft)] text-[var(--color-charcoal)]",
  critical: "border-[var(--color-tone-critical)] bg-[var(--color-tone-critical-soft)] text-[var(--color-charcoal)]",
  neutral: "border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] text-[var(--color-charcoal)]",
};

// Pastilles de catégorie. --color-ivory sert de couleur de contraste : il
// s'inverse à l'opposé de crimson/charcoal, donc le texte reste lisible en
// clair comme en sombre.
export const CATEGORY_COLORS: Record<string, string> = {
  Travaux: "bg-[var(--color-crimson)] text-[var(--color-ivory)]",
  Fournitures: "bg-[var(--color-gold)] text-[var(--color-ivory)]",
  Services: "bg-[var(--color-charcoal)] text-[var(--color-ivory)]",
};

export const CATEGORY_FALLBACK = "bg-[var(--color-ivory-deep)] text-[var(--color-charcoal)]";
