import type { ThemePreference } from "./types";

const STORAGE_KEY = "mp-theme";
const THEMES: ThemePreference[] = ["system", "light", "dark"];

export function normalizeThemePreference(value: unknown): ThemePreference {
  return THEMES.includes(value as ThemePreference) ? (value as ThemePreference) : "system";
}

export function getStoredThemePreference(): ThemePreference {
  return normalizeThemePreference(localStorage.getItem(STORAGE_KEY));
}

export function storeThemePreference(theme: ThemePreference) {
  localStorage.setItem(STORAGE_KEY, theme);
}

export function applyThemePreference(theme: ThemePreference) {
  const normalized = normalizeThemePreference(theme);
  const root = document.documentElement;
  root.dataset.themePreference = normalized;
  root.classList.toggle("dark", normalized === "dark");
  storeThemePreference(normalized);
}
