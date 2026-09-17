import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, CheckCircle2, Gavel, Landmark, XCircle } from "lucide-react";
import { RECOURSE_MOTIFS } from "../lib/procedures";

type WindowState = "open" | "closing" | "expired";

type IconType = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;

/** Highlight pill — signature headline treatment (new-hot-design.md §2.2). */
function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[1.15rem] bg-[var(--color-primary-soft)] px-3 py-0.5 [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">
      {children}
    </span>
  );
}

const FRAME =
  "overflow-hidden rounded-[1.75rem] border border-[color-mix(in_srgb,var(--color-border-subtle)_80%,transparent)] bg-[var(--color-surface)] shadow-card";

const LABEL = "text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted-light)]";

const CONTROL =
  "h-11 w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink)] transition-colors focus:border-[var(--color-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--color-primary)_25%,transparent)] sm:w-72";

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" });
}

function windowState(deadline: Date): WindowState {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(deadline);
  end.setHours(23, 59, 59, 999);
  if (now.getTime() > end.getTime()) return "expired";
  return Math.ceil((end.getTime() - now.getTime()) / 86400000) <= 2 ? "closing" : "open";
}

const stateUi: Record<WindowState, { icon: IconType; label: string; className: string }> = {
  open: { icon: CheckCircle2, label: "Délai ouvert", className: "border-[var(--color-success)] text-[var(--color-success)]" },
  closing: { icon: AlertTriangle, label: "Délai proche", className: "border-[var(--color-warning)] text-[var(--color-warning)]" },
  expired: { icon: XCircle, label: "Délai expiré", className: "border-[var(--color-danger)] text-[var(--color-danger)]" },
};

function DeadlineCard({ title, deadline, detail }: { title: string; deadline: Date; detail: string }) {
  const state = windowState(deadline);
  const UiIcon = stateUi[state].icon;

  return (
    <section className={`rounded-[1.5rem] border-2 bg-[var(--color-surface)] p-5 shadow-card ${stateUi[state].className}`}>
      <div className="inline-flex items-center gap-1.5 rounded-full border border-current px-2.5 py-1">
        <UiIcon size={13} aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-[0.08em]">{stateUi[state].label}</span>
      </div>
      <h2 className="mt-3 text-base font-bold text-[var(--color-ink)]">{title}</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Jusqu'au <strong className="text-[var(--color-ink)]">{formatDate(deadline)}</strong>
      </p>
      <p className="mt-2 text-xs leading-relaxed text-[var(--color-muted)]">{detail}</p>
    </section>
  );
}

export default function Recours({ embedded = false }: { embedded?: boolean }) {
  const [motifId, setMotifId] = useState(RECOURSE_MOTIFS[0].id);
  const [refDate, setRefDate] = useState("");
  const motif = RECOURSE_MOTIFS.find((item) => item.id === motifId) ?? RECOURSE_MOTIFS[0];

  const parsedDate = useMemo(() => {
    if (!refDate) return null;
    const date = new Date(`${refDate}T00:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [refDate]);

  const dateLabel =
    motif.deadlineFrom === "resultat"
      ? "Date de publication du résultat"
      : "Date de réception de la lettre notifiant les motifs d'écartement";

  const content = (
    <div className="space-y-6">
      {/* ─── Motif + date ─────────────────────────────────────── */}
      <section className={FRAME}>
        <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] px-5 py-4">
          <Gavel size={17} className="text-[var(--color-primary)]" aria-hidden="true" />
          <h2 className="text-sm font-black uppercase tracking-[0.06em] text-[var(--color-ink)]">
            Que souhaitez-vous contester ?
          </h2>
        </div>
        <div className="px-5 py-5">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {RECOURSE_MOTIFS.map((item) => {
              const active = item.id === motifId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setMotifId(item.id)}
                  className={`min-h-11 rounded-xl border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] motion-reduce:transition-none ${
                    active
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                      : "border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] hover:border-[var(--color-border)]"
                  }`}
                >
                  <span className="block text-sm font-semibold text-[var(--color-ink)]">{item.label}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-[var(--color-muted)]">{item.description}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <label htmlFor="recours-reference-date" className={`mb-1.5 block ${LABEL}`}>
              {dateLabel}
            </label>
            <input
              id="recours-reference-date"
              type="date"
              className={CONTROL}
              value={refDate}
              onChange={(event) => setRefDate(event.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ─── Computed deadlines ───────────────────────────────── */}
      {parsedDate ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <DeadlineCard
            title="Réclamation au maître d'ouvrage"
            deadline={addDays(parsedDate, 5)}
            detail="Délai indicatif de réclamation administrative selon le point de départ sélectionné."
          />
          <DeadlineCard
            title="Saisine directe de la CNCP"
            deadline={addDays(parsedDate, 7)}
            detail="Calcul indicatif à partir de la date saisie. Les jours ouvrables et circonstances exactes restent à vérifier."
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-2xl border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-4 py-4 text-sm text-[var(--color-muted)]">
          <CalendarClock size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
          Saisissez une date pour calculer les délais.
        </div>
      )}

      {/* ─── Reference notes ──────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className={`${FRAME} p-5`}>
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--color-ink)]">
            <Landmark size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
            Réclamation administrative
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
            Le maître d'ouvrage dispose d'un délai de réponse. La suspension éventuelle dépend du motif et
            des conditions prévues par les textes.
          </p>
        </div>
        <div className={`${FRAME} p-5`}>
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--color-ink)]">
            <Gavel size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
            Saisine de la CNCP
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
            La saisine doit être documentée et compatible avec les voies déjà engagées. Ce calcul ne remplace
            pas une analyse juridique du dossier.
          </p>
        </div>
      </section>

      <p className="border-t border-[var(--color-border-subtle)] pt-4 text-xs leading-relaxed text-[var(--color-muted-light)]">
        Délais indicatifs calculés à partir de la date saisie. Les jours ouvrables, notifications et voies de
        recours exactes dépendent des textes applicables et des circonstances du dossier.
      </p>
    </div>
  );

  if (embedded) return content;

  return (
    <div className="px-3 py-3 sm:px-5 sm:py-4">
      {/* ─── Header card ──────────────────────────────────────── */}
      <section className={`mx-auto ${FRAME}`} aria-labelledby="recours-title">
        <div className="px-5 py-7 sm:px-8">
          <Link
            to="/guide"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-primary)] transition-colors hover:border-[var(--color-border)] hover:text-[var(--color-primary-strong)]"
          >
            <Gavel size={14} aria-hidden="true" />
            Préparer votre candidature
          </Link>

          <h1
            id="recours-title"
            className="mt-4 max-w-2xl text-[clamp(1.7rem,3.4vw,3rem)] font-semibold leading-[1.12] tracking-[0] text-[var(--color-ink)]"
          >
            Calculez vos <Pill>recours</Pill>.
          </h1>

          <p className="mt-4 max-w-[42rem] text-base leading-7 text-[var(--color-muted)]">
            Calculez les délais indicatifs de réclamation et de saisine CNCP.
          </p>
        </div>
      </section>

      {/* ─── Body ─────────────────────────────────────────────── */}
      <div className="mt-6">{content}</div>
    </div>
  );
}
