import { useEffect, useState } from "react";
import { getStats } from "../lib/api";
import type { StatsResponse } from "../lib/types";

const CATEGORY_COLOR: Record<string, string> = {
  Travaux: "bg-primary",
  Fournitures: "bg-secondary",
  Services: "bg-accent",
};

export default function Stats() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="p-6">
        <div className="alert alert-info">
          Pas de données. Importez d'abord les consultations depuis la page d'accueil.
        </div>
      </div>
    );
  }

  const maxSectorCount = Math.max(...data.top_sectors.map((s) => s.count), 1);
  const maxEntityCount = Math.max(...data.top_entities.map((e) => e.count), 1);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Statistiques</h1>

      <div className="stats shadow w-full">
        <div className="stat">
          <div className="stat-title">Total importé</div>
          <div className="stat-value">{data.total}</div>
        </div>
        {data.by_category.map((c) => (
          <div className="stat" key={c.category}>
            <div className="stat-title">{c.category || "Non classé"}</div>
            <div className="stat-value">{c.count}</div>
            <div className="stat-desc">
              {((c.count / data.total) * 100).toFixed(1)}%
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-lg">Top secteurs</h2>
            <div className="space-y-2 mt-2">
              {data.top_sectors.map((s) => (
                <div key={s.sector_code} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{s.sector_name || s.sector_code}</div>
                    <div className="w-full bg-base-200 rounded-full h-2 mt-1">
                      <div
                        className={`h-2 rounded-full ${CATEGORY_COLOR[s.category] || "bg-neutral"}`}
                        style={{ width: `${(s.count / maxSectorCount) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-mono w-10 text-right">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card bg-base-100 shadow">
          <div className="card-body">
            <h2 className="card-title text-lg">Top entités</h2>
            <div className="space-y-2 mt-2">
              {data.top_entities.map((e) => (
                <div key={e.entity} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{e.entity}</div>
                    <div className="w-full bg-base-200 rounded-full h-2 mt-1">
                      <div
                        className="h-2 rounded-full bg-info"
                        style={{ width: `${(e.count / maxEntityCount) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-mono w-10 text-right">{e.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
