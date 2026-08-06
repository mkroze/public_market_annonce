import type { ReactNode } from "react";
import {
  CheckCircle2, XCircle, Loader2, Clock, AlertTriangle, Flag, Archive,
  Eye, ShieldX, Minus,
} from "lucide-react";

type Tone = "success" | "danger" | "warning" | "neutral" | "info" | "running";

// Status is always conveyed by icon + text, never color alone (WCAG).
const TONE_STYLES: Record<Tone, string> = {
  success: "text-green-700 border-green-600/40 bg-green-600/5",
  danger: "text-[var(--color-crimson)] border-[var(--color-crimson)]/40 bg-[var(--color-crimson)]/5",
  warning: "text-[var(--color-gold)] border-[var(--color-gold)]/40 bg-[var(--color-gold)]/5",
  neutral: "text-[var(--color-slate)] border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)]",
  info: "text-[var(--color-charcoal)] border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)]",
  running: "text-[var(--color-gold)] border-[var(--color-gold)]/40 bg-[var(--color-gold)]/5",
};

function Badge({ tone, icon, children }: { tone: Tone; icon: ReactNode; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-sans font-medium whitespace-nowrap ${TONE_STYLES[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}

const ICON = "w-3 h-3 shrink-0";

export function ImportStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "done":
      return <Badge tone="success" icon={<CheckCircle2 className={ICON} aria-hidden />}>Succeeded</Badge>;
    case "failed":
      return <Badge tone="danger" icon={<XCircle className={ICON} aria-hidden />}>Failed</Badge>;
    case "running":
      return <Badge tone="running" icon={<Loader2 className={`${ICON} motion-safe:animate-spin`} aria-hidden />}>Running</Badge>;
    default:
      return <Badge tone="neutral" icon={<Clock className={ICON} aria-hidden />}>{status || "Unknown"}</Badge>;
  }
}

export function ReviewStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "reviewed":
      return <Badge tone="success" icon={<Eye className={ICON} aria-hidden />}>Reviewed</Badge>;
    case "flagged":
      return <Badge tone="danger" icon={<Flag className={ICON} aria-hidden />}>Flagged</Badge>;
    default:
      return <Badge tone="neutral" icon={<Minus className={ICON} aria-hidden />}>Unreviewed</Badge>;
  }
}

export function AdminStatusBadge({ status }: { status: string }) {
  if (status === "archived")
    return <Badge tone="warning" icon={<Archive className={ICON} aria-hidden />}>Archived</Badge>;
  return <Badge tone="success" icon={<CheckCircle2 className={ICON} aria-hidden />}>Active</Badge>;
}

export function DetailBadge({ available }: { available: boolean }) {
  return available
    ? <Badge tone="success" icon={<CheckCircle2 className={ICON} aria-hidden />}>Detail</Badge>
    : <Badge tone="warning" icon={<AlertTriangle className={ICON} aria-hidden />}>No detail</Badge>;
}

export function UserStatusBadge({ status }: { status: string }) {
  if (status === "suspended")
    return <Badge tone="danger" icon={<ShieldX className={ICON} aria-hidden />}>Suspended</Badge>;
  return <Badge tone="success" icon={<CheckCircle2 className={ICON} aria-hidden />}>Active</Badge>;
}

export function ResultBadge({ result }: { result: string }) {
  switch (result) {
    case "success":
      return <Badge tone="success" icon={<CheckCircle2 className={ICON} aria-hidden />}>Success</Badge>;
    case "failure":
      return <Badge tone="danger" icon={<XCircle className={ICON} aria-hidden />}>Failure</Badge>;
    case "partial":
      return <Badge tone="warning" icon={<AlertTriangle className={ICON} aria-hidden />}>Partial</Badge>;
    case "denied":
      return <Badge tone="danger" icon={<ShieldX className={ICON} aria-hidden />}>Denied</Badge>;
    default:
      return <Badge tone="neutral" icon={<Minus className={ICON} aria-hidden />}>{result}</Badge>;
  }
}

export function RoleBadge({ role }: { role: string }) {
  const tone: Tone = role === "owner" ? "danger" : role === "user" ? "neutral" : "info";
  return <Badge tone={tone} icon={null}>{role}</Badge>;
}
