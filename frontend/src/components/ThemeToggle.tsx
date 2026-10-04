import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { updateAccountPreferences } from "../lib/api";
import { useAuth } from "../lib/auth";
import { applyThemePreference, getStoredThemePreference } from "../lib/theme";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Whether the page currently renders dark: an explicit choice, else the OS setting. */
function isDarkNow(): boolean {
  const preference = document.documentElement.dataset.themePreference || getStoredThemePreference();
  if (preference === "dark") return true;
  if (preference === "light") return false;
  return typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
}

/**
 * Bouton clair / sombre. Bascule vers le thème opposé à celui affiché et
 * mémorise le choix (navigateur, et compte si l'utilisateur est connecté).
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { user, updateUser } = useAuth();
  const [dark, setDark] = useState(isDarkNow);

  // Stay in sync when the theme changes elsewhere (account page, OS setting).
  useEffect(() => {
    const sync = () => setDark(isDarkNow());
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme-preference"] });
    const media = typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : null;
    media?.addEventListener("change", sync);
    sync();
    return () => {
      observer.disconnect();
      media?.removeEventListener("change", sync);
    };
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    applyThemePreference(next);
    setDark(next === "dark");
    if (user) {
      // Best effort: the choice already applies locally if the save fails.
      updateAccountPreferences({ theme: next })
        .then((updated) => updateUser?.(updated))
        .catch(() => undefined);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={dark}
      title={dark ? "Passer au mode clair" : "Passer au mode sombre"}
      aria-label={dark ? "Passer au mode clair" : "Passer au mode sombre"}
      className={`inline-grid h-10 w-10 place-items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface)] text-[var(--color-muted)] transition-colors hover:text-[var(--color-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-warning)] motion-reduce:transition-none ${className}`}
    >
      {dark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
    </button>
  );
}
