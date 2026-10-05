export interface TenderUrgency {
  label: string;
  tone: "expired" | "critical" | "warning" | "normal";
  days: number;
  expired: boolean;
}

export function toTenderPath(id: string): string {
  return `/tenders/${encodeURIComponent(id)}`;
}

/** Trim, then uppercase the first character and lowercase the rest (sentence case). */
export function toSentenceCase(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function decodeTenderRouteId(routeId: string | undefined): string {
  return routeId ? decodeURIComponent(routeId) : "";
}

export function parseTenderDeadline(deadline: string): Date | null {
  if (!deadline) return null;
  const match = deadline.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (match) {
    const [, day, month, year, hour = "00", minute = "00"] = match;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
    );
    if (Number.isNaN(parsed.getTime())) return null;

    const matchesInput =
      parsed.getFullYear() === Number(year) &&
      parsed.getMonth() === Number(month) - 1 &&
      parsed.getDate() === Number(day) &&
      parsed.getHours() === Number(hour) &&
      parsed.getMinutes() === Number(minute);

    return matchesInput ? parsed : null;
  }

  const iso = Date.parse(deadline);
  return Number.isNaN(iso) ? null : new Date(iso);
}

export function getTenderUrgency(deadline: string, now = new Date()): TenderUrgency | null {
  const parsed = parseTenderDeadline(deadline);
  if (!parsed) return null;

  const diffMs = parsed.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (days < 0) return { label: "Expirée", tone: "expired", days, expired: true };
  if (days <= 3) return { label: `${days}j`, tone: "critical", days, expired: false };
  if (days <= 7) return { label: `${days}j`, tone: "warning", days, expired: false };
  return { label: `${days}j`, tone: "normal", days, expired: false };
}
