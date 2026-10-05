import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Landmark, XCircle } from "lucide-react";
import PageShell from "../components/PageShell";
import { RECOURSE_MOTIFS } from "../lib/procedures";

type WindowState = "open" | "closing" | "expired";

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

const stateUi: Record<WindowState, { icon: typeof CheckCircle2; label: string; className: string }> = {
  open: { icon: CheckCircle2, label: "Délai ouvert", className: "border-[var(--color-success)] text-[var(--color-success)]" },
  closing: { icon: AlertTriangle, label: "Délai proche", className: "border-[var(--color-warning)] text-[var(--color-warning)]" },
  expired: { icon: XCircle, label: "Délai expiré", className: "border-[var(--color-danger)] text-[var(--color-danger)]" },
};

function DeadlineCard({ title, deadline, detail }: { title: string; deadline: Date; detail: string }) {
  const state = windowState(deadline);
  const UiIcon = stateUi[state].icon;

  return (
    <section className={`rounded-xl border-2 bg-[var(--color-surface)] p-5 shadow-card ${stateUi[state].className}`}>
      <div className="flex items-center gap-2">
        <UiIcon size={16} aria-hidden="true" />
        <p className="editorial-label">{stateUi[state].label}</p>
      </div>
      <h2 className="mt-2 text-base font-bold text-[var(--color-ink)]">{title}</h2>
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
      <section className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card">
        <h2 className="text-lg font-bold text-[var(--color-ink)]">Que souhaitez-vous contester ?</h2>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
          <label htmlFor="recours-reference-date" className="label-academic mb-1.5 block">
            {dateLabel}
          </label>
          <input
            id="recours-reference-date"
            type="date"
            className="institutional-control min-h-11 w-full px-3 text-sm text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] sm:w-72"
            value={refDate}
            onChange={(event) => setRefDate(event.target.value)}
          />
        </div>
      </section>

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
        <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] p-4 text-sm text-[var(--color-muted)]">
          <CalendarClock size={16} aria-hidden="true" />
          Saisissez une date pour calculer les délais.
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card">
          <h2 className="text-base font-bold text-[var(--color-ink)]">Réclamation administrative</h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
            Le maître d'ouvrage dispose d'un délai de réponse. La suspension éventuelle dépend du motif et
            des conditions prévues par les textes.
          </p>
        </div>
        <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-5 shadow-card">
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--color-ink)]">
            <Landmark size={15} className="text-[var(--color-primary)]" aria-hidden="true" />
            Saisine de la CNCP
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
            La saisine doit être documentée et compatible avec les voies déjà engagées. Ce calcul ne remplace
            pas une analyse juridique du dossier.
          </p>
        </div>
      </section>
    </div>
  );

  if (embedded) return content;

  return (
    <PageShell
      title="Assistant recours"
      section="Préparation"
      lead="Calculez les délais indicatifs de réclamation et de saisine CNCP."
      width="wide"
      breadcrumbs={[{ label: "Préparer", to: "/guide" }, { label: "Recours" }]}
    >
      {content}
    </PageShell>
  );
}
