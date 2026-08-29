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
import { getTender, downloadPdf } from "../lib/api";
import { displayText, isHighConfidenceDetected, requiresVerification, signalTone } from "../lib/displayValues";
import { getTenderDecisionChecklist } from "../lib/tenderGuidance";
import { decodeTenderRouteId, getTenderUrgency } from "../lib/tenderUtils";
import { CATEGORY_COLORS, CATEGORY_FALLBACK, TONE_PANEL } from "../lib/tone";
import type { DisplayValue, TenderWithDetails } from "../lib/types";
import Breadcrumbs from "../components/Breadcrumbs";

function rawOrMissing(value: string | undefined | null, missing = "Non détecté"): string {
  return value && value.trim() ? value : missing;
}

function sourceLabel(value: DisplayValue | undefined): string {
  if (!value || value.source === "none" || value.status === "missing" || value.status === "not_applicable") return "";
  if (requiresVerification(value)) return "À vérifier";
  if (value.source === "regex") return "Détecté";
  if (value.source === "agent_import") return "Importé";
  return "";
}

export default function TenderDetail() {
  const { id } = useParams<{ id: string }>();
  const tenderId = decodeTenderRouteId(id);
  const [tender, setTender] = useState<TenderWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");

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
        <Breadcrumbs items={[{ label: "Consultations", to: "/tenders" }, { label: "Détail" }]} className="mb-6" />
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
  const display = tender.display;
  const signals = tender.signals;
  const title = displayText(display?.title, rawOrMissing(d?.objet || tender.title, `Consultation ${tender.reference}`));
  const buyer = displayText(display?.buyer, rawOrMissing(d?.acheteur || tender.entity));
  const location = displayText(display?.location, rawOrMissing(d?.lieu_execution || tender.location));
  const procedure = displayText(display?.procedure, tender.procedure_type || d?.procedure || "Non détecté");
  const category = displayText(display?.category, tender.category || d?.categorie || "Non détecté");
  const deadlineSignal = display?.deadline || {
    value: tender.deadline,
    status: tender.deadline ? "detected" : "missing",
    source: "base",
    confidence: tender.deadline ? "high" : "none",
  } as DisplayValue;
  const deadline = displayText(deadlineSignal, "");
  const urgency = getTenderUrgency(deadline);
  const checklist = getTenderDecisionChecklist(tender);

  return (
    <div className="px-4 sm:px-6 py-8 space-y-8 max-w-4xl mx-auto">
      <Breadcrumbs
        items={[
          { label: "Consultations", to: "/tenders" },
          { label: displayText(display?.reference, tender.reference) || "Détail" },
        ]}
      />

      {/* Header */}
      <div className="border-b border-[var(--color-border-subtle)] pb-6">
        <div className="flex flex-wrap gap-2 items-center mb-3">
          {category !== "Non détecté" && (
            <span className={`inline-block px-2.5 py-1 text-xs font-semibold font-sans rounded ${CATEGORY_COLORS[category] || CATEGORY_FALLBACK}`}>
              {category}
            </span>
          )}
          <span className="inline-block px-2.5 py-1 text-xs font-semibold font-sans rounded border border-[var(--color-border-subtle)] text-[var(--color-slate)]">
            {procedure}
          </span>
          {d?.annonce_type && (
            <span className="inline-block px-2.5 py-1 text-xs font-sans rounded bg-[var(--color-ivory-dim)] text-[var(--color-slate)]">
              {d.annonce_type}
            </span>
          )}
        </div>

        <h1 className="font-display text-2xl font-bold text-[var(--color-charcoal)] leading-tight">
          {title}
        </h1>

        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm font-sans text-[var(--color-slate)]">
          <span className="flex items-center gap-1.5">
            <Tag size={14} /> {displayText(display?.reference, tender.reference)}
          </span>
          {buyer !== "Non détecté" && (
            <span className="flex items-center gap-1.5">
              <Building2 size={14} /> {buyer}
            </span>
          )}
          {location !== "Non détecté" && (
            <span className="flex items-center gap-1.5">
              <MapPin size={14} /> {location}
            </span>
          )}
          {deadline && (
            <span className={`flex items-center gap-1.5 font-medium ${urgency?.expired ? "text-[var(--color-border)]" : "text-[var(--color-crimson)]"}`}>
              <Calendar size={14} />
              Échéance: {deadline}{urgency ? ` (${urgency.label})` : ""}
            </span>
          )}
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SignalCard icon={Calendar} title="Échéance" value={deadlineSignal} />
        <SignalCard icon={Banknote} title="Budget estimé" value={signals?.estimation} />
        <SignalCard icon={Shield} title="Caution" value={signals?.caution} />
        <SignalCard icon={Download} title="DCE" value={signals?.dce_available} />
        <SignalCard icon={Users} title="Candidatures" value={signals?.applications_count} />
        <SignalCard icon={Landmark} title="Prix marché" value={signals?.market_price} />
      </section>

      <section className="rounded-xl shadow-card border border-[var(--color-border-subtle)] bg-[var(--color-ivory)] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="rounded bg-[var(--color-crimson)] p-2 text-[var(--color-ivory)]">
            <HelpCircle size={18} />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--color-charcoal)]">
              Dois-je poursuivre cette opportunité ?
            </h2>
            <p className="mt-1 font-sans text-sm text-[var(--color-slate)]">
              Les données détectées peuvent être incomplètes. Vérifiez les points critiques dans le DCE avant de préparer une offre.
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {checklist.map((item) => (
            <div key={item.id} className={`rounded border p-3 ${TONE_PANEL[item.tone]}`}>
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
      {pdfError && (
        <div className="border border-[var(--color-crimson)] border-l-4 rounded px-4 py-3 text-[var(--color-crimson)] text-sm font-sans">
          {pdfError}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {d?.dce_url && (
          <a
            href={d.dce_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary font-sans font-semibold gap-2"
          >
            <Download size={16} /> Télécharger le DCE
          </a>
        )}
        <button
          className="flex items-center gap-2 px-4 py-2 text-sm font-sans font-medium rounded border border-[var(--color-crimson)] text-[var(--color-crimson)] hover:bg-[var(--color-crimson)] hover:text-[var(--color-ivory)] transition-colors"
          disabled={pdfLoading}
          onClick={async () => {
            if (!tenderId) return;
            setPdfLoading(true);
            setPdfError("");
            try { await downloadPdf(tenderId); }
            catch (e) { setPdfError(e instanceof Error ? e.message : "Échec de l'export PDF"); }
            finally { setPdfLoading(false); }
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
        <InfoCard icon={Landmark} title="Domaine d'activité" value={rawOrMissing(d?.domaines || tender.sector_name)} />
        {isHighConfidenceDetected(signals?.plan_price) && <InfoCard icon={Banknote} title="Prix d'acquisition des plans" value={displayText(signals?.plan_price)} highlight />}
        {d?.variante && <InfoCard icon={FileText} title="Variante" value={d.variante} />}
      </div>

      {/* Addresses */}
      {(d?.adresse_retrait || d?.adresse_depot || d?.lieu_ouverture) && (
        <Section icon={MapPin} title="Adresses">
          {d?.adresse_retrait && <Field label="Retrait des dossiers" value={d.adresse_retrait} />}
          {d?.adresse_depot && <Field label="Dépôt des offres" value={d.adresse_depot} />}
          {d?.lieu_ouverture && <Field label="Ouverture des plis" value={d.lieu_ouverture} />}
        </Section>
      )}

      {/* Conditions */}
      {(d?.qualifications || d?.agrements || d?.allotissement || d?.reserved_pme) && (
        <Section icon={Users} title="Conditions de participation">
          {d?.allotissement && <Field label="Allotissement" value={d.allotissement} />}
          {d?.qualifications && <Field label="Qualifications requises" value={d.qualifications} />}
          {d?.agrements && <Field label="Agréments requis" value={d.agrements} />}
          {d?.reserved_pme && <Field label="Réservé TPE/PME" value={d.reserved_pme} />}
        </Section>
      )}

      {/* Reunion & Visite */}
      {(d?.reunion || d?.visite_lieux) && (
        <Section icon={Eye} title="Réunion & Visite">
          {d?.reunion && <Field label="Réunion" value={d.reunion} />}
          {d?.visite_lieux && <Field label="Visite des lieux" value={d.visite_lieux} />}
        </Section>
      )}

      {/* Contact */}
      {d?.contact && (
        <Section icon={Phone} title="Contact">
          <ContactBlock text={d.contact} />
        </Section>
      )}

      {/* Données source brutes : outil de diagnostic, réservé au développement. */}
      {import.meta.env.DEV && <RawSourceDrawer tender={tender} />}

    </div>
  );
}

/* ─── Section ─── */
function Section({ icon: Icon, title, children }: { icon: typeof Building2; title: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--color-border-subtle)] rounded-xl shadow-card overflow-hidden">
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
    <div className="border border-[var(--color-border-subtle)] rounded-xl shadow-card px-5 py-4 hover:border-[var(--color-border)] hover:shadow-card-hover transition-all">
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

function SignalCard({ icon: Icon, title, value }: {
  icon: typeof Building2;
  title: string;
  value: DisplayValue | undefined;
}) {
  const tone = signalTone(value);
  const label = sourceLabel(value);
  const toneClass = tone === "strong"
    ? "border-[var(--color-crimson)] text-[var(--color-charcoal)]"
    : tone === "warning"
      ? "border-[var(--color-gold)] text-[var(--color-charcoal)]"
      : "border-[var(--color-border-subtle)] text-[var(--color-slate)]";

  return (
    <div className={`rounded-xl shadow-card border bg-[var(--color-ivory)] px-4 py-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={15} className={tone === "muted" ? "text-[var(--color-slate)]" : "text-[var(--color-crimson)]"} />
          <p className="label-academic">{title}</p>
        </div>
        {label && <span className="text-[11px] font-sans text-[var(--color-slate)]">{label}</span>}
      </div>
      <p className={`mt-2 font-sans leading-snug ${tone === "strong" ? "text-base font-bold tabular-nums" : "text-sm font-medium"}`}>
        {displayText(value)}
      </p>
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

function RawSourceDrawer({ tender }: { tender: TenderWithDetails }) {
  const d = tender.details;
  const rows = [
    ["Titre source", tender.title],
    ["Reference", tender.reference],
    ["Acheteur source", tender.entity],
    ["Code acheteur", tender.entity_code],
    ["Categorie source", tender.category],
    ["Secteur", tender.sector_name],
    ["Code secteur", tender.sector_code],
    ["Procedure source", tender.procedure_type],
    ["Lieu source", tender.location],
    ["Date limite", tender.deadline],
    ["Date publication", tender.publication_date],
    ["Statut", tender.status],
    ["URL source", tender.detail_url],
    ["Horodatage source", tender.scraped_at],
    ["Estimation source", tender.estimation],
    ["Objet detail", d?.objet],
    ["Acheteur detail", d?.acheteur],
    ["Type d'annonce", d?.annonce_type],
    ["Procedure detail", d?.procedure],
    ["Categorie detail", d?.categorie],
    ["Lieu execution detail", d?.lieu_execution],
    ["Estimation detail", d?.estimation],
    ["Domaines", d?.domaines],
    ["Caution detail", d?.caution_provisoire],
    ["Prix plans detail", d?.prix_plans],
    ["Allotissement", d?.allotissement],
    ["Qualifications", d?.qualifications],
    ["Agrements", d?.agrements],
    ["Adresse retrait", d?.adresse_retrait],
    ["Adresse depot", d?.adresse_depot],
    ["Lieu ouverture", d?.lieu_ouverture],
    ["Variante", d?.variante],
    ["Reunion", d?.reunion],
    ["Visite des lieux", d?.visite_lieux],
    ["Reserve TPE/PME", d?.reserved_pme],
    ["Contact", d?.contact],
    ["URL documents", d?.documents_url],
    ["URL DCE", d?.dce_url],
    ["URL avis", d?.avis_url],
    ["Horodatage detail", d?.scraped_at],
  ].filter(([, value]) => value && String(value).trim());

  if (!rows.length) return null;

  return (
    <details className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-ivory)]">
      <summary className="cursor-pointer px-5 py-3 font-sans text-sm font-semibold text-[var(--color-charcoal)]">
        Données source
      </summary>
      <div className="divide-y divide-[var(--color-border-subtle)] px-5">
        {rows.map(([label, value]) => (
          <Field key={label} label={label || ""} value={String(value)} />
        ))}
      </div>
    </details>
  );
}
