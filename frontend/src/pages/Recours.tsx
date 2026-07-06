import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Gavel, ArrowLeft, CalendarClock, CheckCircle2, AlertTriangle, XCircle, Landmark } from "lucide-react";
import { RECOURSE_MOTIFS } from "../lib/procedures";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("fr-MA", { day: "numeric", month: "long", year: "numeric" });
}

type WindowState = "open" | "closing" | "expired";

function windowState(deadline: Date): WindowState {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(deadline);
  end.setHours(23, 59, 59, 999);
  if (now.getTime() > end.getTime()) return "expired";
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);
  return daysLeft <= 2 ? "closing" : "open";
}

const STATE_UI: Record<WindowState, { icon: typeof CheckCircle2; label: string; className: string }> = {
  open: { icon: CheckCircle2, label: "Délai ouvert", className: "border-green-700 text-green-800" },
  closing: { icon: AlertTriangle, label: "Délai expirant bientôt", className: "border-[var(--color-gold)] text-[var(--color-gold)]" },
  expired: { icon: XCircle, label: "Délai expiré", className: "border-[var(--color-crimson)] text-[var(--color-crimson)]" },
};

function DeadlineCard({ title, deadline, detail }: { title: string; deadline: Date; detail: string }) {
  const state = windowState(deadline);
  const ui = STATE_UI[state];
  const Icon = ui.icon;
  return (
    <div className={`rounded border-2 bg-[var(--color-ivory-dim)] p-4 ${ui.className}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className="shrink-0" />
        <span className="font-sans text-xs font-semibold uppercase tracking-wider">{ui.label}</span>
      </div>
      <p className="font-display font-bold text-[var(--color-charcoal)]">{title}</p>
      <p className="font-sans text-sm text-[var(--color-charcoal)] mt-1">
        Jusqu'au <span className="font-semibold">{formatDate(deadline)}</span>
      </p>
      <p className="font-sans text-xs text-[var(--color-slate)] mt-1">{detail}</p>
    </div>
  );
}

export default function Recours() {
  const [motifId, setMotifId] = useState<string>(RECOURSE_MOTIFS[0].id);
  const [refDate, setRefDate] = useState<string>("");

  const motif = RECOURSE_MOTIFS.find((m) => m.id === motifId)!;
  const parsedDate = useMemo(() => {
    if (!refDate) return null;
    const d = new Date(refDate + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }, [refDate]);

  const dateLabel =
    motif.deadlineFrom === "resultat"
      ? "Date de publication du résultat"
      : "Date de réception de la lettre notifiant les motifs d'écartement";

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link
          to="/procedures"
          className="inline-flex items-center gap-1.5 font-sans text-sm text-[var(--color-slate)] hover:text-[var(--color-crimson)] transition-colors mb-3"
        >
          <ArrowLeft size={14} />
          Procédures de passation
        </Link>
        <div className="flex items-center gap-2.5 mb-1">
          <Gavel className="w-6 h-6 text-[var(--color-crimson)]" />
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">
            Assistant recours
          </h1>
        </div>
        <p className="font-sans text-sm text-[var(--color-slate)] ml-[34px]">
          Réclamations et saisine de la CNCP — articles 163 et 164 du décret n° 2.22.431, décret n° 2-14-867
        </p>
      </div>

      {/* Motif selection */}
      <section className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)]">
        <div className="p-5">
          <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)] mb-4">
            Que souhaitez-vous contester ?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {RECOURSE_MOTIFS.map((m) => {
              const active = m.id === motifId;
              return (
                <button
                  key={m.id}
                  onClick={() => setMotifId(m.id)}
                  className={`text-left p-3 rounded border transition-colors ${
                    active
                      ? "border-[var(--color-crimson)] bg-[var(--color-ivory-dim)]"
                      : "border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] hover:border-[var(--color-border)]"
                  }`}
                >
                  <p className={`font-sans text-sm font-semibold ${active ? "text-[var(--color-crimson)]" : "text-[var(--color-charcoal)]"}`}>
                    {m.label}
                  </p>
                  <p className="font-sans text-xs text-[var(--color-slate)] mt-0.5">{m.description}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <label className="label-academic block mb-1.5 font-sans text-xs uppercase tracking-wider text-[var(--color-slate)]">
              {dateLabel}
            </label>
            <input
              type="date"
              className="w-full sm:w-64 rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] px-3 py-2 font-sans text-[var(--color-charcoal)] focus:outline-none focus:border-[var(--color-crimson)] transition-colors"
              value={refDate}
              onChange={(e) => setRefDate(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Computed deadlines */}
      {parsedDate ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DeadlineCard
            title="Réclamation au maître d'ouvrage"
            deadline={addDays(parsedDate, 5)}
            detail={
              motif.deadlineFrom === "resultat"
                ? "Recevable depuis la publication de l'avis jusqu'au 5e jour après la publication du résultat (art. 163)."
                : "Dans les 5 jours suivant la réception de la lettre notifiant les motifs d'écartement (art. 163)."
            }
          />
          <DeadlineCard
            title="Saisine directe de la CNCP"
            deadline={addDays(parsedDate, 7)}
            detail="Entre la publication de l'avis et le 7e jour après l'affichage des résultats (art. 164, décret n° 2-14-867). Calcul indicatif à partir de la date saisie."
          />
        </div>
      ) : (
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] p-4 flex items-center gap-2 font-sans text-sm text-[var(--color-slate)]">
          <CalendarClock size={16} />
          Saisissez la date pour calculer vos délais de recours.
        </div>
      )}

      {/* Procedure explanation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-5">
          <h2 className="font-display text-base font-bold text-[var(--color-charcoal)] mb-3">
            Réclamation administrative (art. 163)
          </h2>
          <ul className="space-y-2 font-sans text-sm text-[var(--color-slate)]">
            <li className="pl-3 border-l-2 border-[var(--color-border-subtle)]">
              Le maître d'ouvrage dispose de <span className="font-semibold text-[var(--color-charcoal)]">5 jours</span> pour répondre.
            </li>
            <li className="pl-3 border-l-2 border-[var(--color-border-subtle)]">
              En cas de silence ou d'insatisfaction : <span className="font-semibold text-[var(--color-charcoal)]">5 jours supplémentaires</span> pour
              saisir, selon le cas, le ministre concerné, le ministre de l'intérieur ou le président de
              l'organe délibérant.
            </li>
            {motif.suspensionPossible ? (
              <li className="pl-3 border-l-2 border-[var(--color-gold)]">
                L'autorité saisie doit ordonner la <span className="font-semibold text-[var(--color-charcoal)]">suspension de la procédure
                (10 jours max)</span> si la réclamation est fondée et qu'un dommage risque d'être subi. Elle peut
                ensuite rejeter, imposer un redressement ou annuler la procédure — ou ordonner la poursuite
                pour des raisons urgentes d'intérêt général.
              </li>
            ) : (
              <li className="pl-3 border-l-2 border-[var(--color-border-subtle)]">
                La suspension de la procédure n'est prévue que pour les vices de procédure, clauses
                discriminatoires et conflits d'intérêts.
              </li>
            )}
          </ul>
        </section>

        <section className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-[var(--color-charcoal)] mb-3">
            <Landmark size={15} className="text-[var(--color-crimson)]" />
            Saisine de la CNCP (art. 164)
          </h2>
          <ul className="space-y-2 font-sans text-sm text-[var(--color-slate)]">
            <li className="pl-3 border-l-2 border-[var(--color-border-subtle)]">
              Dépôt direct, par poste recommandée ou par voie électronique ; réservée aux concurrents
              ayant intérêt à conclure, avec pièces justificatives.
            </li>
            <li className="pl-3 border-l-2 border-[var(--color-border-subtle)]">
              L'administration répond sous <span className="font-semibold text-[var(--color-charcoal)]">10 jours ouvrables</span> ; instruction par la
              CNCP sous <span className="font-semibold text-[var(--color-charcoal)]">15 jours ouvrables</span>, prorogeable une fois de 15 jours ouvrables.
            </li>
            <li className="pl-3 border-l-2 border-[var(--color-border-subtle)]">
              La suspension de la procédure ou le sursis à l'approbation ne peuvent être décidés que par le
              <span className="font-semibold text-[var(--color-charcoal)]"> Chef du gouvernement</span>, sur proposition de la CNCP.
            </li>
            <li className="pl-3 border-l-2 border-[var(--color-gold)]">
              Vous devez déclarer que le litige n'a pas déjà été porté devant les tribunaux : un recours
              juridictionnel met fin à l'instruction devant la CNCP.
            </li>
          </ul>
        </section>
      </div>

      <p className="font-sans text-xs text-[var(--color-slate)] border-t border-[var(--color-border-subtle)] pt-4">
        Calculs indicatifs. Les délais exacts (jours ouvrables, points de départ, affichage des résultats)
        dépendent des circonstances de chaque procédure. Le contentieux juridictionnel relève de la loi
        n° 41-90 ; le décret de 2023 ne prévoit ni délai spécial ni effet suspensif automatique pour cette
        voie. Ce guide ne remplace pas un conseil juridique.
      </p>
    </div>
  );
}
