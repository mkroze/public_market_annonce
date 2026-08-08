import type { DisplayValue } from "./types";

export function displayText(value: DisplayValue | undefined, missingLabel = "Non detecte"): string {
  if (!value) return missingLabel;
  if (value.status === "missing") return missingLabel;
  if (value.status === "not_applicable") return "Non applicable";
  if (value.value === null || value.value === undefined || value.value === "") return missingLabel;
  if (typeof value.value === "boolean") return value.value ? "Disponible" : missingLabel;
  return String(value.value);
}

export function isDetected(value: DisplayValue | undefined): boolean {
  return Boolean(value && value.status === "detected" && value.value !== null && value.value !== "");
}

export function signalTone(value: DisplayValue | undefined): "strong" | "muted" | "warning" {
  if (!value || value.status === "missing" || value.status === "not_applicable") return "muted";
  if (value.status === "needs_verification" || value.confidence === "low") return "warning";
  return "strong";
}
