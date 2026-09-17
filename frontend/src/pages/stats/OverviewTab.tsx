import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { Building2, FileText, Hammer, Layers3, Package, Wrench } from "lucide-react";
import { getStats } from "../../lib/api";
import type { StatsResponse } from "../../lib/types";

const FRAME =
  "overflow-hidden rounded-[1.75rem] border border-[color-mix(in_srgb,var(--color-border-subtle)_80%,transparent)] bg-[var(--color-surface)] shadow-card";

const GRID_FRAME =
  "grid gap-px overflow-hidden rounded-[1.75rem] border border-[color-mix(in_srgb,var(--color-border-subtle)_80%,transparent)] bg-[var(--color-border-subtle)] shadow-card";

const LABEL = "text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-muted-light)]";

type IconType = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;

/** Sigle marchand : réutilise un acronyme majuscule présent dans le nom
 *  (ONCF, ONEE, OCP…) ou, à défaut, construit les initiales des mots forts. */
function toSigle(name: string): string {
  const s = (name || "").trim();
  if (!s) return "—";
  const acronym = s.match(/\b[A-Z][A-Z0-9]{1,5}\b/);
  if (acronym) return acronym[0];
  const stop = new Set(["de", "du", "des", "d", "la", "le", "les", "l", "et", "au", "aux", "pour", "sur", "the", "of", "and"]);
  const words = s
    .replace(/['’\-]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !stop.has(w.toLowerCase()));
  const initials = words.slice(0, 4).map((w) => w[0]!.toUpperCase()).join("");
  return initials || s.slice(0, 3).toUpperCase();
}

/** Catégorie → icône + teinte de la pastille (tokens uniquement). */
const CATEGORY: Record<string, { icon: IconType; tile: string }> = {
  Travaux: { icon: Hammer, tile: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]" },
  Fournitures: { icon: Package, tile: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]" },
  Services: { icon: Wrench, tile: "bg-[var(--color-surface-strong)] text-[var(--color-ink)]" },
};
const DEFAULT_CATEGORY = { icon: Layers3, tile: "bg-[var(--color-surface-muted)] text-[var(--color-muted)]" };

// KPI + strips ─────────────────────────────────────────────────────────────
function KpiStrip({ kpis }: { kpis: NonNullable<StatsResponse["kpis"]> }) {
  const items = [
    { label: "Actives", value: kpis.active, accent: "text-[var(--color-primary)]" },
    { label: "Clôture < 7 j", value: kpis.closing_7d, accent: "text-[var(--color-warning)]" },
    { label: "Ajoutées (7 j)", value: kpis.new_7d, accent: "text-[var(--color-ink)]" },
    { label: "Acheteurs", value: kpis.distinct_buyers, accent: "text-[var(--color-ink)]" },
  ];
  return (
    <div className={`grid-cols-2 sm:grid-cols-4 ${GRID_FRAME}`}>
      {items.map((item) => (
        <div key={item.label} className="bg-[var(--color-surface)] px-6 py-5">
          <p className={LABEL}>{item.label}</p>
          <p className={`mt-1.5 text-3xl font-semibold tabular-nums ${item.accent}`}>
            {item.value.toLocaleString("fr-FR")}
          </p>
        </div>
      ))}
    </div>
  );
}

function StatsStrip({ total, byCategory }: { total: number; byCategory: StatsResponse["by_category"] }) {
  return (
    <div className={`grid-cols-1 sm:grid-cols-4 ${GRID_FRAME}`}>
      <div className="bg-[var(--color-surface)] px-6 py-5">
        <p className={LABEL}>Total importé</p>
        <p className="mt-1.5 text-3xl font-semibold tabular-nums text-[var(--color-primary)]">
          {total.toLocaleString("fr-FR")}
        </p>
      </div>
      {byCategory.map((c) => (
        <div key={c.category} className="bg-[var(--color-surface)] px-6 py-5">
          <p className={LABEL}>{c.category || "Non classé"}</p>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-[var(--color-ink)]">
            {c.count.toLocaleString("fr-FR")}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-[var(--color-muted)]">
            {((c.count / total) * 100).toFixed(1)}%
          </p>
        </div>
      ))}
    </div>
  );
}

// Panels + chips ────────────────────────────────────────────────────────────
function Panel({ title, icon: Icon, children }: { title: string; icon: IconType; children: ReactNode }) {
  return (
    <div className={FRAME}>
      <div className="flex items-center gap-2 border-b border-[var(--color-border-subtle)] px-5 py-4">
        <Icon size={17} className="text-[var(--color-primary)]" aria-hidden={true} />
        <h2 className="text-sm font-black uppercase tracking-[0.06em] text-[var(--color-ink)]">{title}</h2>
      </div>
      <ul className="flex flex-wrap gap-2 px-5 py-4">{children}</ul>
    </div>
  );
}

/** Chip horizontal : pastille (icône ou sigle) + libellé optionnel + compteur.
 *  `title` porte le nom complet (visible au survol). */
function Chip({
  leading,
  label,
  labelClass = "",
  count,
  title,
}: {
  leading: ReactNode;
  label?: ReactNode;
  labelClass?: string;
  count: number;
  title: string;
}) {
  return (
    <li
      title={title}
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface)] py-1 pl-1 pr-3 transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]"
    >
      {leading}
      {label != null && (
        <span className={`truncate text-sm font-medium text-[var(--color-ink)] ${labelClass}`}>{label}</span>
      )}
      <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--color-muted)]">
        {count.toLocaleString("fr-FR")}
      </span>
    </li>
  );
}

function IconTile({ icon: Icon, tone }: { icon: IconType; tone: string }) {
  return (
    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${tone}`}>
      <Icon size={15} aria-hidden={true} />
    </span>
  );
}

export default function OverviewTab() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getStats()
      .then(setData)
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg text-[var(--color-primary)]"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[var(--color-danger)] bg-[var(--color-danger-soft)] px-5 py-4 text-sm text-[var(--color-danger)]">
        Une erreur est survenue lors du chargement des statistiques. Veuillez réessayer.
        <button
          onClick={() => {
            setLoading(true);
            setError(null);
            getStats()
              .then(setData)
              .catch(setError)
              .finally(() => setLoading(false));
          }}
          className="ml-3 font-semibold underline"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-5 py-4 text-sm text-[var(--color-muted)]">
        Pas de données. Importez d'abord les consultations depuis la page d'accueil.
      </div>
    );
  }

  const byProcedure = data.by_procedure ?? [];

  return (
    <div className="space-y-6">
      {data.kpis && <KpiStrip kpis={data.kpis} />}

      <StatsStrip total={data.total} byCategory={data.by_category} />

      <Panel title="Top secteurs" icon={Layers3}>
        {data.top_sectors.map((s, index) => {
          const cat = CATEGORY[s.category] ?? DEFAULT_CATEGORY;
          const name = s.sector_name || s.sector_code;
          return (
            <Chip
              key={index}
              title={name}
              leading={<IconTile icon={cat.icon} tone={cat.tile} />}
              label={name}
              labelClass="max-w-[13rem]"
              count={s.count}
            />
          );
        })}
      </Panel>

      <Panel title="Top entités" icon={Building2}>
        {data.top_entities.map((e, index) => (
          // Le sigle fait office de logo — remplacer par <img> si un jeu de logos existe un jour.
          <Chip
            key={index}
            title={e.entity}
            leading={
              <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-[var(--color-primary)] px-2.5 text-xs font-bold text-[var(--color-on-primary)]">
                {toSigle(e.entity)}
              </span>
            }
            count={e.count}
          />
        ))}
      </Panel>

      {byProcedure.length > 0 && (
        <Panel title="Répartition par procédure" icon={FileText}>
          {byProcedure.map((p, index) => {
            const name = p.procedure_type || "Non précisé";
            return (
              <Chip
                key={index}
                title={name}
                leading={<IconTile icon={FileText} tone="bg-[var(--color-surface-muted)] text-[var(--color-primary)]" />}
                label={name}
                labelClass="max-w-[15rem]"
                count={p.count}
              />
            );
          })}
        </Panel>
      )}
    </div>
  );
}
