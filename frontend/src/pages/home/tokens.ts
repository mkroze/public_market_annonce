// Shared class tokens, helpers and hooks for the landing page sections.
import { useEffect, useRef, useState, type RefObject } from "react";
import { getTenderUrgency } from "../../lib/tenderUtils";
import type { Tender } from "../../lib/types";

export const FRAME =
  "overflow-hidden rounded-[1.75rem] border border-[color-mix(in_srgb,var(--color-border-subtle)_80%,transparent)] bg-[var(--color-surface)] shadow-card";

export const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-warning)]";

export const CTA_PRIMARY = `inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-6 text-sm font-semibold text-[var(--color-on-primary)] no-underline shadow-[0_16px_36px_-24px_rgba(0,35,111,0.82)] transition-transform hover:-translate-y-0.5 hover:bg-[var(--color-primary-strong)] motion-reduce:transition-none ${FOCUS}`;

export const CTA_SECONDARY = `inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-6 text-sm font-semibold text-[var(--color-ink)] no-underline transition-transform hover:-translate-y-0.5 hover:bg-[var(--color-surface-muted)] motion-reduce:transition-none ${FOCUS}`;

export const REASSURANCE = ["Compte gratuit", "Sans carte bancaire", "Inscription en quelques secondes"] as const;

export interface PrimaryCta {
  to: string;
  label: string;
}

export const fmt = (n: number) => n.toLocaleString("fr-FR");

/** True when the visitor (OS setting) or the site's motion toggle asks for no animation. */
export function motionDisabled(): boolean {
  if (typeof window === "undefined") return true;
  if (document.documentElement.dataset.motion === "off") return true;
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Flips to true the first time the element scrolls into view (and stays true). */
export function useInView<T extends Element>(rootMargin = "0px 0px -10% 0px"): [RefObject<T | null>, boolean] {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, rootMargin]);

  return [ref, inView];
}

/** Counts from 0 up to `target` once `run` is true; jumps straight to it when motion is off. */
export function useCountUp(target: number, run: boolean, durationMs = 900): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!run) return;
    if (motionDisabled()) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      // easeOutCubic: fast start, soft landing on the real figure.
      setValue(Math.round(target * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, run, durationMs]);

  return run ? value : 0;
}

/** Same deadline semantics as the catalog's TenderCard, as a compact badge. */
export function deadlineBadge(deadline: string): { label: string; className: string } {
  const urgency = getTenderUrgency(deadline);
  if (!urgency) {
    return {
      label: "Date à vérifier",
      className: "border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] text-[var(--color-muted)]",
    };
  }
  if (urgency.expired) {
    return {
      label: "Expirée",
      className:
        "border-[color-mix(in_srgb,var(--color-tone-critical)_28%,transparent)] bg-[var(--color-tone-critical-soft)] text-[var(--color-tone-critical)]",
    };
  }
  if (urgency.days <= 7) {
    return {
      label: urgency.days <= 0 ? "Dernier jour" : `Clôture · ${urgency.days} j`,
      className:
        "border-[color-mix(in_srgb,var(--color-tone-warning)_35%,transparent)] bg-[var(--color-tone-warning-soft)] text-[var(--color-ink)]",
    };
  }
  return {
    label: `J-${urgency.days}`,
    className:
      "border-[color-mix(in_srgb,var(--color-tone-positive)_30%,transparent)] bg-[var(--color-tone-positive-soft)] text-[var(--color-tone-positive)]",
  };
}

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} 10:00`;
}

function sample(id: string, title: string, entity: string, location: string, category: string, days: number): Tender {
  return {
    id, title, entity, location, category,
    reference: "", entity_code: "", sector_code: "", sector_name: "", publication_date: "",
    status: "en_cours", procedure_type: "AOO", detail_url: "", scraped_at: "", deadline: inDays(days),
  };
}

/** Fictional consultations, shown only when the catalog can't be reached — and
 *  always labelled as an illustrative preview, never as live data. */
export const SAMPLE_TENDERS: Tender[] = [
  sample("exemple-1", "Travaux d'aménagement de voirie communale", "Commune (exemple)", "Casablanca", "Travaux", 21),
  sample("exemple-2", "Fourniture de matériel informatique", "Établissement public (exemple)", "Rabat", "Fournitures", 12),
  sample("exemple-3", "Prestations de gardiennage et de nettoyage", "Direction provinciale (exemple)", "Marrakech", "Services", 5),
  sample("exemple-4", "Travaux d'assainissement liquide", "Commune (exemple)", "Fès", "Travaux", 30),
  sample("exemple-5", "Achat de mobilier de bureau", "Direction régionale (exemple)", "Tanger", "Fournitures", 17),
  sample("exemple-6", "Maintenance des installations électriques", "Établissement public (exemple)", "Agadir", "Services", 9),
];
