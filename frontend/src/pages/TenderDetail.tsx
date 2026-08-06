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
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { getTender, downloadDce, downloadPdf } from "../lib/api";
import { getTenderDecisionChecklist } from "../lib/tenderGuidance";
import { decodeTenderRouteId, getTenderUrgency } from "../lib/tenderUtils";
import type { TenderWithDetails } from "../lib/types";

const CATEGORY_COLORS: Record<string, string> = {
  Travaux: "bg-[var(--color-crimson)] text-white",
  Fournitures: "bg-[var(--color-gold)] text-white",
  Services: "bg-[var(--color-charcoal)] text-white",
};

const CHECK_TONE_CLASS = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  critical: "border-red-200 bg-red-50 text-red-900",
  neutral: "border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)] text-[var(--color-charcoal)]",
};

export default function TenderDetail() {
  const { id } = useParams<{ id: string }>();
  const tenderId = decodeTenderRouteId(id);
  const [tender, setTender] = useState<TenderWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dceLoading, setDceLoading] = useState(false);
  const [dceError, setDceError] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!tenderId) return;
    setLoading(true);
    getTender(tenderId)
      .then(setTender)
      .catch(() => setError("Impossible de charger cette consultation"))
      .finally(() => setLoading(false));
  }, [tenderId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <span className="loading loading-spinner loading-lg text-[var(--color-crimson)]"></span>
      </div>
    );
  }

  if (error || !tender) {
    return (
      <div className="px-4 sm:px-6 py-8">
        <div className="border border-[var(--color-crimson)] border-l-4 rounded px-4 py-3 text-[var(--color-crimson)] text-sm font-sans">
          {error || "Consultation introuvable"}
        </div>
        <Link to="/tenders" className="inline-flex items-center gap-1.5 mt-4 text-sm font-sans text-[var(--color-crimson)] hover:underline">
          <ArrowLeft size={14} /> Retour
        </Link>
      </div>
    );
  }

  const d = tender.details;
  const urgency = getTenderUrgency(tender.deadline);
  const checklist = getTenderDecisionChecklist(tender);

  return (
    <div className="px-4 sm:px-6 py-8 space-y-8 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        to="/tenders"
        className="inline-flex items-center gap-1.5 text-sm font-sans text-[var(--color-crimson)] hover:underline"
      >
        <ArrowLeft size={14} /> Retour aux consultations
      </Link>

      {/* Header */}
      <div className="border-b border-[var(--color-border-subtle)] pb-6">
        <div className="flex flex-wrap gap-2 items-center mb-3">
          {tender.category && (
            <span className={`inline-block px-2.5 py-1 text-xs font-semibold font-sans rounded ${CATEGORY_COLORS[tender.category] || "bg-base-300"}`}>
              {tender.category}
            </span>
          )}
          <span className="inline-block px-2.5 py-1 text-xs font-semibold font-sans rounded border border-[var(--color-border-subtle)] text-[var(--color-slate)]">
            {tender.procedure_type || d?.procedure || "—"}
          </span>
          {d?.annonce_type && (
            <span className="inline-block px-2.5 py-1 text-xs font-sans rounded bg-[var(--color-ivory-dim)] text-[var(--color-slate)]">
              {d.annonce_type}
            </span>
          )}
        </div>

        <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)] leading-tight">
          {d?.objet || tender.title}
        </h1>

        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm font-sans text-[var(--color-slate)]">
          <span className="flex items-center gap-1.5">
            <Tag size={14} /> {tender.reference}
          </span>
          {(tender.location || d?.lieu_execution) && (
            <span className="flex items-center gap-1.5">
              <MapPin size={14} /> {d?.lieu_execution || tender.location}
            </span>
          )}
          <span className={`flex items-center gap-1.5 font-medium ${urgency?.expired ? "text-[var(--color-border)]" : "text-[var(--color-crimson)]"}`}>
            <Calendar size={14} />
            Échéance: {tender.deadline}{urgency ? ` (${urgency.label})` : ""}
          </span>
        </div>
      </div>

      {/* Decision summary */}
      <section className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded bg-[var(--color-crimson)] p-2 text-white">
            <HelpCircle size={18} />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">
              Dois-je poursuivre cette opportunite ?
            </h2>
            <p className="mt-1 font-sans text-sm text-[var(--color-slate)]">
              Verifiez d'abord les points qui bloquent souvent une PME : delai, lieu, budget, caution, qualifications et documents.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {checklist.map((item) => (
            <div key={item.id} className={`rounded border p-3 ${CHECK_TONE_CLASS[item.tone]}`}>
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-sans text-sm font-semibold">{item.label}</p>
                  <p className="mt-0.5 font-sans text-sm">{item.value}</p>
                  <p className="mt-1 font-sans text-xs opacity-80">{item.action}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      {dceError && (
        <div className="border border-[var(--color-crimson)] border-l-4 rounded px-4 py-3 text-[var(--color-crimson)] text-sm font-sans">
          {dceError}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {d?.dce_url && (
          <button
            className="btn btn-primary font-sans font-semibold gap-2"
            disabled={dceLoading}
            onClick={async () => {
              if (!tenderId) return;
              setDceLoading(true);
              setDceError("");
              try { await downloadDce(tenderId); }
              catch (e) { setDceError(e instanceof Error ? e.message : "Echec du telechargement"); }
              finally { setDceLoading(false); }
            }}
          >
            {dceLoading ? <span className="loading loading-spinner loading-sm"></span> : <Download size={16} />}
            {dceLoading ? "Telechargement..." : "Telecharger le DCE"}
          </button>
        )}
        <button
          className="flex items-center gap-2 px-4 py-2 text-sm font-sans font-medium rounded border border-[var(--color-crimson)] text-[var(--color-crimson)] hover:bg-[var(--color-crimson)] hover:text-white transition-colors"
          disabled={pdfLoading}
          onClick={async () => {
            if (!tenderId) return;
            setPdfLoading(true);
            try { await downloadPdf(tenderId); } catch {} finally { setPdfLoading(false); }
          }}
        >
          {pdfLoading ? <span className="loading loading-spinner loading-sm"></span> : <FileText size={16} />}
          Export PDF
        </button>
        {d?.avis_url && (
          <a href={d.avis_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 text-sm font-sans font-medium rounded border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] transition-colors text-[var(--color-charcoal)]">
            <FileText size={16} /> Avis de publication
          </a>
        )}
        {tender.detail_url && (
          <a href={tender.detail_url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 text-sm font-sans text-[var(--color-slate)] hover:text-[var(--color-charcoal)] transition-colors">
            <ExternalLink size={16} /> Voir sur marchespublics.gov.ma
          </a>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard icon={Building2} title="Acheteur public" value={d?.acheteur || tender.entity} />
        <InfoCard icon={Landmark} title="Domaine d'activite" value={d?.domaines || tender.sector_name} />
        {d?.estimation && <InfoCard icon={Banknote} title="Estimation (TTC)" value={d.estimation} highlight />}
        {d?.caution_provisoire && <InfoCard icon={Shield} title="Caution provisoire" value={d.caution_provisoire} highlight />}
        {d?.prix_plans && <InfoCard icon={Banknote} title="Prix d'acquisition des plans" value={d.prix_plans} highlight />}
        {d?.variante && <InfoCard icon={FileText} title="Variante" value={d.variante} />}
      </div>

      {/* Addresses */}
      {(d?.adresse_retrait || d?.adresse_depot || d?.lieu_ouverture) && (
        <Section icon={MapPin} title="Adresses">
          {d?.adresse_retrait && <Field label="Retrait des dossiers" value={d.adresse_retrait} />}
          {d?.adresse_depot && <Field label="Depot des offres" value={d.adresse_depot} />}
          {d?.lieu_ouverture && <Field label="Ouverture des plis" value={d.lieu_ouverture} />}
        </Section>
      )}

      {/* Conditions */}
      {(d?.qualifications || d?.agrements || d?.allotissement || d?.reserved_pme) && (
        <Section icon={Users} title="Conditions de participation">
          {d?.allotissement && <Field label="Allotissement" value={d.allotissement} />}
          {d?.qualifications && <Field label="Qualifications requises" value={d.qualifications} />}
          {d?.agrements && <Field label="Agrements requis" value={d.agrements} />}
          {d?.reserved_pme && <Field label="Reserve TPE/PME" value={d.reserved_pme} />}
        </Section>
      )}

      {/* Reunion & Visite */}
      {(d?.reunion || d?.visite_lieux) && (
        <Section icon={Eye} title="Reunion & Visite">
          {d?.reunion && <Field label="Reunion" value={d.reunion} />}
          {d?.visite_lieux && <Field label="Visite des lieux" value={d.visite_lieux} />}
        </Section>
      )}

      {/* Contact */}
      {d?.contact && (
        <Section icon={Phone} title="Contact">
          <ContactBlock text={d.contact} />
        </Section>
      )}

    </div>
  );
}

/* ─── Section ─── */
function Section({ icon: Icon, title, children }: { icon: typeof Building2; title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--color-border-subtle)] rounded">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-ivory-dim)]">
        <Icon size={16} className="text-[var(--color-crimson)]" />
        <h2 className="font-display text-base font-bold text-[var(--color-charcoal)]">{title}</h2>
      </div>
      <div className="divide-y divide-[var(--color-border-subtle)] px-5">
        {children}
      </div>
    </div>
  );
}

/* ─── InfoCard ─── */
function InfoCard({ icon: Icon, title, value, highlight = false }: {
  icon: typeof Building2; title: string; value: string; highlight?: boolean;
}) {
  return (
    <div className="border border-[var(--color-border-subtle)] rounded px-5 py-4 hover:border-[var(--color-border)] transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded bg-[var(--color-ivory-dim)] flex items-center justify-center shrink-0">
          <Icon size={16} className="text-[var(--color-crimson)]" />
        </div>
        <div className="min-w-0">
          <p className="label-academic">{title}</p>
          <p className={`mt-1 leading-snug font-sans ${highlight ? "text-lg font-bold text-[var(--color-crimson)] tabular-nums" : "text-sm font-medium text-[var(--color-charcoal)]"}`}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Field ─── */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-3">
      <p className="label-academic mb-1">{label}</p>
      <p className="text-sm leading-relaxed font-sans text-[var(--color-charcoal)]">{value}</p>
    </div>
  );
}

/* ─── ContactBlock ─── */
function ContactBlock({ text }: { text: string }) {
  const emailRegex = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
  const phoneRegex = /(?:\+?\d[\d\s\-().]{6,}\d)/g;

  // Extract all emails and phones from the full text
  const emails = [...new Set(text.match(emailRegex) || [])];
  const rawPhones = (text.match(phoneRegex) || []).map((p) => p.trim());

  // Normalize: strip spaces/dashes/dots/parens, then format nicely
  function formatPhone(raw: string): string {
    const digits = raw.replace(/[\s\-().]/g, "");
    // +212XXXXXXXXX → 0X XX XX XX XX
    if (digits.startsWith("+212") && digits.length === 13) {
      const local = "0" + digits.slice(4);
      return local.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
    }
    // 0XXXXXXXXX (10 digits) → 0X XX XX XX XX
    if (digits.startsWith("0") && digits.length === 10) {
      return digits.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, "$1 $2 $3 $4 $5");
    }
    return raw;
  }

  const phones = [...new Set(rawPhones.map(formatPhone))];

  // Remove extracted emails/phones from text to get remaining lines
  let remaining = text;
  for (const e of emails) remaining = remaining.replace(e, "");
  for (const p of phones) remaining = remaining.replace(p, "");
  const textLines = remaining
    .split(/\n/)
    .map((l) => l.replace(/[,;:|]+$/, "").trim())
    .filter((l) => l.length > 1);

  return (
    <div className="py-3 space-y-2">
      {textLines.map((line, i) => (
        <div key={`t-${i}`} className="flex items-center gap-2 text-sm font-sans">
          <User size={14} className="text-[var(--color-slate)] shrink-0" />
          <span className="text-[var(--color-charcoal)]">{line}</span>
        </div>
      ))}
      {emails.map((email, i) => (
        <div key={`e-${i}`} className="flex items-center gap-2 text-sm font-sans">
          <Mail size={14} className="text-[var(--color-crimson)] shrink-0" />
          <a href={`mailto:${email}`} className="text-[var(--color-crimson)] hover:underline">{email}</a>
        </div>
      ))}
      {phones.map((phone, i) => (
        <div key={`p-${i}`} className="flex items-center gap-2 text-sm font-sans">
          <Phone size={14} className="text-[var(--color-crimson)] shrink-0" />
          <a href={`tel:${phone.replace(/\s/g, "")}`} className="text-[var(--color-charcoal)] hover:underline">{phone}</a>
        </div>
      ))}
    </div>
  );
}
