import { useCallback, useLayoutEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const STORAGE_KEY = "mp-motion";

/**
 * Bouton « animations on/off ».
 * Pose `data-motion="off"` sur <html> ; le CSS coupe alors toutes les
 * animations décoratives (cascade, dérive, survol). L'accessibilité motrice
 * reste garantie par `prefers-reduced-motion` côté CSS, indépendamment de ce
 * réglage manuel.
 */
export default function MotionToggle({ className = "" }: { className?: string }) {
  const [on, setOn] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  });

  useLayoutEffect(() => {
    document.documentElement.dataset.motion = on ? "on" : "off";
    try {
      window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
    } catch {
      /* stockage indisponible : réglage volatil, sans incidence */
    }
  }, [on]);

  const toggle = useCallback(() => setOn((v) => !v), []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title={on ? "Animations activées" : "Animations désactivées"}
      aria-label={on ? "Désactiver les animations" : "Activer les animations"}
      className={`inline-grid h-9 w-9 place-items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)] motion-reduce:transition-none ${
        on ? "" : "opacity-55"
      } ${className}`}
    >
      <Sparkles size={16} />
    </button>
  );
}
