import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Briefcase, Building, MapPin } from "lucide-react";
import { getSectorDetail } from "../lib/api";
import type { SectorDetailResponse } from "../lib/types";

export default function SectorDetail() {
  const { code } = useParams<{ code: string }>();
  const [sector, setSector] = useState<SectorDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    getSectorDetail(decodeURIComponent(code))
      .then(setSector)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-[var(--color-crimson)] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!sector) {
    return (
      <div className="px-4 sm:px-6 py-8">
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory-dim)] p-4 text-[var(--color-slate)] font-sans text-sm">
          Secteur introuvable.
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Link to="/sectors" className="inline-flex items-center gap-1 text-[var(--color-crimson)] hover:underline font-sans text-sm mb-3">
          <ArrowLeft size={14} />
          Retour aux secteurs
        </Link>
        <div className="flex items-center gap-2">
          <Briefcase size={22} className="text-[var(--color-crimson)]" />
          <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)]">{sector.name}</h1>
        </div>
        <p className="text-[var(--color-slate)] font-sans text-sm mt-1">Code : {sector.code}</p>
      </div>

      <div className="flex gap-4">
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] px-6 py-4 flex-1">
          <div className="label-academic text-[var(--color-slate)]">Total consultations</div>
          <div className="text-2xl font-bold tabular-nums text-[var(--color-charcoal)] mt-1">{sector.total}</div>
        </div>
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] px-6 py-4 flex-1">
          <div className="label-academic text-[var(--color-slate)]">Actives</div>
          <div className="text-2xl font-bold tabular-nums text-[var(--color-crimson)] mt-1">{sector.active}</div>
        </div>
      </div>

      {sector.top_entities.length > 0 && (
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-5">
          <div className="flex items-center gap-2">
            <Building size={16} className="text-[var(--color-slate)]" />
            <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">Top acheteurs</h2>
          </div>
          <div className="divider-academic my-3"></div>
          <div className="space-y-2">
            {sector.top_entities.map((e) => (
              <div
                key={e.entity}
                className="flex items-center justify-between p-3 rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)]"
              >
                <span className="font-sans text-sm text-[var(--color-charcoal)]">{e.entity}</span>
                <span className="tabular-nums font-sans text-sm font-bold text-[var(--color-crimson)]">{e.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {sector.top_locations.length > 0 && (
        <div className="border border-[var(--color-border-subtle)] rounded bg-[var(--color-ivory)] p-5">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-[var(--color-slate)]" />
            <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">Top localisations</h2>
          </div>
          <div className="divider-academic my-3"></div>
          <div className="space-y-2">
            {sector.top_locations.map((loc) => (
              <Link
                key={loc.location}
                to={`/cities/${encodeURIComponent(loc.location)}`}
                className="flex items-center justify-between p-3 rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] bg-[var(--color-ivory-dim)] transition-colors"
              >
                <span className="font-sans text-sm text-[var(--color-charcoal)]">{loc.location}</span>
                <span className="tabular-nums font-sans text-sm font-bold text-[var(--color-crimson)]">{loc.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <Link
          to={`/tenders?sector=${encodeURIComponent(sector.code)}`}
          className="inline-flex items-center px-5 py-2.5 rounded border border-[var(--color-crimson)] bg-[var(--color-crimson)] text-white font-sans text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Voir toutes les consultations de ce secteur
        </Link>
      </div>
    </div>
  );
}
