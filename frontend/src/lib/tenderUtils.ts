export interface TenderUrgency {
  label: string;
  tone: "expired" | "critical" | "warning" | "normal";
  days: number;
  expired: boolean;
}

export function toTenderPath(id: string): string {
  return `/tenders/${encodeURIComponent(id)}`;
}

export function decodeTenderRouteId(routeId: string | undefined): string {
  return routeId ? decodeURIComponent(routeId) : "";
}

export function parseTenderDeadline(deadline: string): Date | null {
  if (!deadline) return null;
  const iso = Date.parse(deadline);
  if (!Number.isNaN(iso)) return new Date(iso);

  const match = deadline.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!match) return null;

  const [, day, month, year, hour = "00", minute = "00"] = match;
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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
