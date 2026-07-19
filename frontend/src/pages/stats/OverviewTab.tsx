import { useEffect, useState } from "react";
import { getStats } from "../../lib/api";
import type { StatsResponse } from "../../lib/types";

const CATEGORY_BAR: Record<string, string> = {
  Travaux: "bg-[var(--color-crimson)]",
  Fournitures: "bg-[var(--color-gold)]",
  Services: "bg-[var(--color-charcoal)]",
};

function KpiStrip({ kpis }: { kpis: NonNullable<StatsResponse["kpis"]> }) {
  const items = [
    { label: "Actives", value: kpis.active, accent: "text-[var(--color-crimson)]" },
    { label: "Clôture < 7 j", value: kpis.closing_7d, accent: "text-[var(--color-gold)]" },
    { label: "Ajoutées (7 j)", value: kpis.new_7d, accent: "text-[var(--color-charcoal)]" },
    { label: "Acheteurs", value: kpis.distinct_buyers, accent: "text-[var(--color-charcoal)]" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border border-[var(--color-border-subtle)] rounded overflow-hidden">
      {items.map((item) => (
        <div key={item.label} className="bg-base-100 px-6 py-5">
          <p className="label-academic">{item.label}</p>
          <p className={`text-3xl font-bold font-display mt-1 tabular-nums ${item.accent}`}>
            {item.value.toLocaleString("fr-FR")}
          </p>
        </div>
      ))}
    </div>
  );
}

function StatsStrip({ total, byCategory }: { total: number; byCategory: StatsResponse["by_category"] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-px border border-[var(--color-border-subtle)] rounded overflow-hidden">
      <div className="bg-base-100 px-6 py-5">
        <p className="label-academic">Total importé</p>
        <p className="text-3xl font-bold font-display text-[var(--color-crimson)] mt-1 tabular-nums">
          {total.toLocaleString("fr-FR")}
        </p>
      </div>
      {byCategory.map((c) => (
        <div key={c.category} className="bg-base-100 px-6 py-5 border-l border-[var(--color-border-subtle)]">
          <p className="label-academic">{c.category || "Non classé"}</p>
          <p className="text-2xl font-bold font-sans text-[var(--color-charcoal)] mt-1 tabular-nums">
            {c.count.toLocaleString("fr-FR")}
          </p>
          <p className="text-xs text-[var(--color-slate)] mt-0.5 font-sans tabular-nums">
            {((c.count / total) * 100).toFixed(1)}%
          </p>
        </div>
      ))}
    </div>
  );
}

function TopList({
  title,
  items,
  maxCount,
  colorClass,
  getLabel,
}: {
  title: string;
  items: Array<{ count: number; [key: string]: any }>;
  maxCount: number;
  colorClass: string | ((item: any) => string);
  getLabel: (item: any) => string;
}) {
  return (
    <div className="border border-[var(--color-border-subtle)] rounded">
      <div className="px-5 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)]">
        <h2 className="font-display text-base font-bold text-[var(--color-charcoal)]">{title}</h2>
      </div>
      <div className="px-5 py-3 space-y-3">
        {items.map((item, index) => {
          const count = item.count;
          const label = getLabel(item);
          const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div key={index} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-sans text-[var(--color-charcoal)] truncate">{label}</div>
                <div
                  className="w-full bg-[var(--color-ivory-deep)] rounded h-1.5 mt-1"
                  role="progressbar"
                  aria-valuenow={count}
                  aria-valuemin={0}
                  aria-valuemax={maxCount}
                  aria-label={`${title} : ${label}`}
                >
                  <div
                    className={`h-1.5 rounded ${typeof colorClass === "function" ? colorClass(item) : colorClass}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-sans font-semibold tabular-nums w-10 text-right text-[var(--color-charcoal)]">
                {count.toLocaleString("fr-FR")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
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
        <span className="loading loading-spinner loading-lg text-[var(--color-crimson)]"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-300 bg-red-50 rounded px-4 py-3 text-sm font-sans text-red-700">
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
          className="ml-3 underline font-semibold"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="border border-[var(--color-border-subtle)] rounded px-4 py-3 text-sm font-sans text-[var(--color-slate)]">
        Pas de données. Importez d'abord les consultations depuis la page d'accueil.
      </div>
    );
  }

  const maxSectorCount = Math.max(...data.top_sectors.map((s) => s.count), 1);
  const maxEntityCount = Math.max(...data.top_entities.map((e) => e.count), 1);
  const byProcedure = data.by_procedure ?? [];
  const maxProcedureCount = Math.max(...byProcedure.map((p) => p.count), 1);

  return (
    <div className="space-y-8">
      {data.kpis && <KpiStrip kpis={data.kpis} />}

      <StatsStrip total={data.total} byCategory={data.by_category} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TopList
          title="Top secteurs"
          items={data.top_sectors}
          maxCount={maxSectorCount}
          colorClass={(item) => CATEGORY_BAR[item.category] || "bg-[var(--color-slate)]"}
          getLabel={(item) => item.sector_name || item.sector_code}
        />
        <TopList
          title="Top entités"
          items={data.top_entities}
          maxCount={maxEntityCount}
          colorClass="bg-[var(--color-crimson)]"
          getLabel={(item) => item.entity}
        />
        {byProcedure.length > 0 && (
          <TopList
            title="Répartition par procédure"
            items={byProcedure}
            maxCount={maxProcedureCount}
            colorClass="bg-[var(--color-charcoal)]"
            getLabel={(item) => item.procedure_type || "Non précisé"}
          />
        )}
      </div>
    </div>
  );
}
