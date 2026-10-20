import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Shared with the pipeline: a quiet KPI strip and clearly bounded work areas. */
export function IndicateursAdministration({ items, label = "Indicateurs" }: {
  items: { label: string; value: ReactNode; note?: ReactNode; warning?: boolean }[]; label?: string;
}) {
  return <section className="stage-metrics admin-metric-strip" aria-label={label}>
    {items.map((item) => <div className={`stage-metric ${item.warning ? "admin-metric-warning" : ""}`} key={item.label}>
      <span className="stage-eyebrow">{item.label}</span><strong>{item.value}</strong>
      <span className="stage-metric-note">{item.note || "\u00a0"}</span>
    </div>)}
  </section>;
}

export function PanneauAdministration({ title, icon: Icon, aside, children, className = "" }: {
  title: string; icon?: LucideIcon; aside?: ReactNode; children: ReactNode; className?: string;
}) {
  return <section aria-label={title} className={`stage-pane admin-pane ${className}`}>
    <div className="stage-pane-heading"><h2>{Icon && <Icon size={16} aria-hidden />}{title}</h2>{aside && <span className="stage-pane-caption">{aside}</span>}</div>
    <div className="stage-pane-body">{children}</div>
  </section>;
}
