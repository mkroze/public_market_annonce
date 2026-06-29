import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Building2,
  Calendar,
  FileText,
  Download,
  Phone,
  Tag,
  Landmark,
  Banknote,
  Shield,
  Users,
  Eye,
  Mail,
  User,
} from "lucide-react";
import { getTender, downloadDce } from "../lib/api";
import type { TenderWithDetails } from "../lib/types";

const CATEGORY_BADGE: Record<string, string> = {
  Travaux: "badge-primary",
  Fournitures: "badge-secondary",
  Services: "badge-accent",
};

export default function TenderDetail() {
  const { id } = useParams<{ id: string }>();
  const [tender, setTender] = useState<TenderWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dceLoading, setDceLoading] = useState(false);
  const [dceError, setDceError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getTender(id)
      .then(setTender)
      .catch(() => setError("Impossible de charger cette consultation"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error || !tender) {
    return (
      <div className="p-6">
        <div className="alert alert-error">{error || "Consultation introuvable"}</div>
        <Link to="/tenders" className="btn btn-ghost mt-4">
          <ArrowLeft size={16} /> Retour
        </Link>
      </div>
    );
  }

  const d = tender.details;

  return (
    <div className="p-6 space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <Link to="/tenders" className="btn btn-ghost btn-sm mb-4">
          <ArrowLeft size={16} /> Retour aux consultations
        </Link>

        <div className="flex flex-wrap gap-2 items-center mb-3">
          {tender.category && (
            <span className={`badge badge-lg ${CATEGORY_BADGE[tender.category] || "badge-ghost"}`}>
              {tender.category}
            </span>
          )}
          <span className="badge badge-lg badge-outline">
            {tender.procedure_type || d?.procedure || "—"}
          </span>
          {d?.annonce_type && (
            <span className="badge badge-lg badge-ghost">{d.annonce_type}</span>
          )}
        </div>

        <h1 className="text-2xl font-bold leading-tight">
          {d?.objet || tender.title}
        </h1>

        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm text-base-content/60">
          <span className="flex items-center gap-1.5">
            <Tag size={14} className="text-base-content/40" /> {tender.reference}
          </span>
          {(tender.location || d?.lieu_execution) && (
            <span className="flex items-center gap-1.5">
              <MapPin size={14} className="text-base-content/40" /> {d?.lieu_execution || tender.location}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Calendar size={14} className="text-warning" />
            Date limite:{" "}
            <strong className="text-warning font-semibold">{tender.deadline}</strong>
          </span>
        </div>
      </div>

      {/* Main info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard
          icon={Building2}
          title="Acheteur public"
          value={d?.acheteur || tender.entity}
        />
        <InfoCard
          icon={Landmark}
          title="Domaine d'activite"
          value={d?.domaines || tender.sector_name}
        />
        {d?.estimation && (
          <InfoCard icon={Banknote} title="Estimation (TTC)" value={d.estimation} highlight />
        )}
        {d?.caution_provisoire && (
          <InfoCard icon={Shield} title="Caution provisoire" value={d.caution_provisoire} highlight />
        )}
        {d?.prix_plans && (
          <InfoCard icon={Banknote} title="Prix d'acquisition des plans" value={d.prix_plans} highlight />
        )}
        {d?.variante && (
          <InfoCard icon={FileText} title="Variante" value={d.variante} />
        )}
      </div>

      {/* Adresses section */}
      {(d?.adresse_retrait || d?.adresse_depot || d?.lieu_ouverture) && (
        <div className="card bg-base-200/60 border border-base-300 shadow">
          <div className="card-body gap-0">
            <h2 className="card-title text-lg mb-4">
              <MapPin size={18} className="text-primary" /> Adresses
            </h2>
            <div className="divide-y divide-base-300">
              {d?.adresse_retrait && (
                <div className="py-3 first:pt-0 last:pb-0">
                  <Field label="Retrait des dossiers" value={d.adresse_retrait} />
                </div>
              )}
              {d?.adresse_depot && (
                <div className="py-3 first:pt-0 last:pb-0">
                  <Field label="Depot des offres" value={d.adresse_depot} />
                </div>
              )}
              {d?.lieu_ouverture && (
                <div className="py-3 first:pt-0 last:pb-0">
                  <Field label="Ouverture des plis" value={d.lieu_ouverture} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Conditions section */}
      {(d?.qualifications || d?.agrements || d?.allotissement || d?.reserved_pme) && (
        <div className="card bg-base-200/60 border border-base-300 shadow">
          <div className="card-body gap-0">
            <h2 className="card-title text-lg mb-4">
              <Users size={18} className="text-primary" /> Conditions de participation
            </h2>
            <div className="divide-y divide-base-300">
              {d?.allotissement && (
                <div className="py-3 first:pt-0 last:pb-0">
                  <Field label="Allotissement" value={d.allotissement} />
                </div>
              )}
              {d?.qualifications && (
                <div className="py-3 first:pt-0 last:pb-0">
                  <Field label="Qualifications requises" value={d.qualifications} />
                </div>
              )}
              {d?.agrements && (
                <div className="py-3 first:pt-0 last:pb-0">
                  <Field label="Agrements requis" value={d.agrements} />
                </div>
              )}
              {d?.reserved_pme && (
                <div className="py-3 first:pt-0 last:pb-0">
                  <Field label="Reserve TPE/PME" value={d.reserved_pme} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reunion / Visite */}
      {(d?.reunion || d?.visite_lieux) && (
        <div className="card bg-base-200/60 border border-base-300 shadow">
          <div className="card-body gap-0">
            <h2 className="card-title text-lg mb-4">
              <Eye size={18} className="text-primary" /> Reunion & Visite
            </h2>
            <div className="divide-y divide-base-300">
              {d?.reunion && (
                <div className="py-3 first:pt-0 last:pb-0">
                  <Field label="Reunion" value={d.reunion} />
                </div>
              )}
              {d?.visite_lieux && (
                <div className="py-3 first:pt-0 last:pb-0">
                  <Field label="Visite des lieux" value={d.visite_lieux} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contact */}
      {d?.contact && (
        <div className="card bg-base-200/60 border border-base-300 shadow">
          <div className="card-body gap-0">
            <h2 className="card-title text-lg mb-4">
              <Phone size={18} className="text-primary" /> Contact
            </h2>
            <ContactBlock text={d.contact} />
          </div>
        </div>
      )}

      {/* Actions */}
      {dceError && (
        <div className="alert alert-error alert-sm">
          {dceError}
        </div>
      )}
      <div className="flex flex-wrap gap-3 pt-2">
        {d?.dce_url && (
          <button
            className="btn btn-primary btn-md"
            disabled={dceLoading}
            onClick={async () => {
              if (!id) return;
              setDceLoading(true);
              setDceError("");
              try {
                await downloadDce(id);
              } catch (e) {
                setDceError(e instanceof Error ? e.message : "Echec du telechargement");
              } finally {
                setDceLoading(false);
              }
            }}
          >
            {dceLoading ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <Download size={16} />
            )}
            {dceLoading ? "Telechargement..." : "Telecharger le dossier"}
          </button>
        )}
        {d?.avis_url && (
          <a href={d.avis_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-md">
            <FileText size={16} /> Avis de publication
          </a>
        )}
        {tender.detail_url && (
          <a href={tender.detail_url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-md">
            <ExternalLink size={16} /> Voir sur marchespublics.gov.ma
          </a>
        )}
      </div>
    </div>
  );
}

/* ─── InfoCard ─── */

function InfoCard({
  icon: Icon,
  title,
  value,
  highlight = false,
}: {
  icon: typeof Building2;
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="card bg-base-200/60 border border-base-300 shadow-sm hover:shadow transition-shadow">
      <div className="card-body py-5 px-5">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
            <Icon size={20} className="text-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-xs text-base-content/50 uppercase tracking-wider font-medium">
              {title}
            </div>
            <div
              className={`mt-1 leading-snug ${
                highlight
                  ? "text-lg font-bold text-accent tabular-nums"
                  : "text-sm font-medium"
              }`}
            >
              {value}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Field ─── */

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-base-content/40 uppercase tracking-wider font-medium mb-1">
        {label}
      </div>
      <div className="text-sm leading-relaxed">{value}</div>
    </div>
  );
}

/* ─── ContactBlock ─── */

function ContactBlock({ text }: { text: string }) {
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[\d\s\-+().]{7,}$/;

  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (emailRegex.test(line)) {
          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              <Mail size={14} className="text-primary shrink-0" />
              <a href={`mailto:${line}`} className="link link-hover link-primary">
                {line}
              </a>
            </div>
          );
        }
        if (phoneRegex.test(line)) {
          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              <Phone size={14} className="text-primary shrink-0" />
              <a href={`tel:${line.replace(/\s/g, "")}`} className="link link-hover">
                {line}
              </a>
            </div>
          );
        }
        return (
          <div key={i} className="flex items-center gap-2 text-sm">
            <User size={14} className="text-base-content/40 shrink-0" />
            <span>{line}</span>
          </div>
        );
      })}
    </div>
  );
}
