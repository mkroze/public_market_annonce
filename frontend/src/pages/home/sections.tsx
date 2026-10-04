// Landing page sections below the hero. Every figure shown comes from the
// public stats/catalog endpoints; anything that can't be (a visitor's own
// criteria, the state of a checklist) is labelled as an example.
import type { ReactNode, Ref } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, ArrowUpRight, BarChart3, Bell, Briefcase, Building2,
  CalendarClock, Check, ChevronDown, CircleDashed, ClipboardCheck, Download,
  HardHat, Layers3, Map, MapPin, Package, Ruler, Search, ShieldCheck, Store,
} from "lucide-react";
import { toSentenceCase, toTenderPath } from "../../lib/tenderUtils";
import type { StatsResponse, Tender } from "../../lib/types";
import { FOCUS, FRAME, REASSURANCE, deadlineBadge, fmt, type PrimaryCta } from "./tokens";
import { AppWindow, LiveBadge, Pill, Reveal, SectionHeader } from "./ui";

const SECTION = "mx-auto max-w-7xl py-12 sm:py-16";
const EXAMPLE_TAG =
  "rounded-full border border-[var(--color-border-subtle)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-muted)]";

/* ─── Les trois bénéfices, démontrés ──────────────────────────────── */

function DemoRow({
  index, title, text, points, visual, reverse = false,
}: {
  index: string;
  title: string;
  text: string;
  points: readonly string[];
  visual: ReactNode;
  reverse?: boolean;
}) {
  return (
    <Reveal className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <div className={`min-w-0 ${reverse ? "lg:order-2" : ""}`}>
        <p className="text-sm font-bold tabular-nums text-[var(--color-primary)]">{index}</p>
        <h3 className="mt-2 text-[clamp(1.35rem,2.4vw,1.9rem)] font-semibold leading-[1.15] text-[var(--color-ink)]">{title}</h3>
        <p className="mt-3 max-w-xl text-base leading-7 text-[var(--color-muted)]">{text}</p>
        <ul className="mt-5 space-y-2.5 text-sm text-[var(--color-ink)]">
          {points.map((point) => (
            <li key={point} className="flex gap-2.5">
              <Check size={17} className="mt-0.5 shrink-0 text-[var(--color-success)]" aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div className={`min-w-0 ${reverse ? "lg:order-1" : ""}`}>{visual}</div>
    </Reveal>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-strong)]" aria-hidden="true">
      <span className="block h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${max ? Math.max(6, (value / max) * 100) : 0}%` }} />
    </span>
  );
}

/** 01 — the catalog's filter facets, with the catalog's real volumes. */
function FacetPanel({ stats, live }: { stats: StatsResponse | null; live: boolean }) {
  const sectors = stats?.top_sectors.slice(0, 4) ?? [];
  const max = Math.max(1, ...sectors.map((s) => s.count));
  const procedures = stats?.by_procedure?.slice(0, 4) ?? [];
  return (
    <AppWindow title="Consultations — Filtres" badge={<LiveBadge live={live && !!stats} />}>
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex h-10 items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-4 text-sm text-[var(--color-muted-light)]">
          <Search size={15} aria-hidden="true" />
          Rechercher…
        </div>

        {sectors.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-light)]">Secteur</p>
            <ul className="mt-2 space-y-2.5">
              {sectors.map((s) => (
                <li key={s.sector_code}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate text-[var(--color-ink)]">{s.sector_name}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-[var(--color-muted)]">{fmt(s.count)}</span>
                  </div>
                  <div className="mt-1"><Bar value={s.count} max={max} /></div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-light)]">Ville</p>
            <div className="mt-1.5 flex h-9 items-center justify-between rounded-xl border border-[var(--color-border-subtle)] px-3 text-sm text-[var(--color-ink)]">
              <span className="inline-flex items-center gap-1.5"><MapPin size={14} aria-hidden="true" /> Toutes les villes</span>
              <ChevronDown size={15} className="text-[var(--color-muted-light)]" aria-hidden="true" />
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-light)]">Échéance</p>
            <div className="mt-1.5 flex h-9 items-center justify-between rounded-xl border border-[var(--color-border-subtle)] px-3 text-sm text-[var(--color-ink)]">
              <span className="inline-flex items-center gap-1.5"><CalendarClock size={14} aria-hidden="true" /> Sous 7 jours</span>
              {stats?.kpis && <span className="font-semibold tabular-nums text-[var(--color-muted)]">{fmt(stats.kpis.closing_7d)}</span>}
            </div>
          </div>
        </div>

        {procedures.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-light)]">Procédure</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {procedures.map((p, i) => (
                <span
                  key={p.procedure_type}
                  className={`rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums ${
                    i === 0
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                      : "border-[var(--color-border-subtle)] text-[var(--color-muted)]"
                  }`}
                >
                  {p.procedure_type || "Autre"} · {fmt(p.count)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppWindow>
  );
}

/** 02 — the daily alert e-mail, laid out like the one the product sends. */
function EmailPreview({ tenders, live }: { tenders: Tender[]; live: boolean }) {
  const items = tenders.slice(0, 3);
  const many = items.length > 1;
  return (
    <AppWindow title="Boîte de réception" badge={<span className={`shrink-0 ${EXAMPLE_TAG}`}>Aperçu de l'e-mail</span>}>
      <div className="border-b border-[var(--color-border-subtle)] px-4 py-3 sm:px-5">
        <p className="text-sm font-bold text-[var(--color-ink)]">
          {many ? `${items.length} nouveaux appels d'offres pour votre alerte` : "1 nouvel appel d'offres pour votre alerte"}
        </p>
        <p className="mt-0.5 text-xs text-[var(--color-muted)]">MP Maroc · chaque matin</p>
      </div>
      <div className="p-4 sm:p-5">
        <p className="text-sm text-[var(--color-ink)]">
          {many
            ? `${items.length} nouvelles consultations correspondent à votre alerte.`
            : "1 nouvelle consultation correspond à votre alerte."}
        </p>
        <p className="mt-4 text-sm font-bold text-[var(--color-primary)]">Nouveaux appels d'offres</p>
        <ul className="mt-2 space-y-2">
          {items.map((tender) => (
            <li key={tender.id} className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-muted)] px-3.5 py-3">
              {live ? (
                <Link to={toTenderPath(tender.id)} className={`line-clamp-2 text-sm font-bold leading-5 text-[var(--color-primary)] ${FOCUS}`}>
                  {toSentenceCase(tender.title)}
                </Link>
              ) : (
                <p className="line-clamp-2 text-sm font-bold leading-5 text-[var(--color-primary)]">{toSentenceCase(tender.title)}</p>
              )}
              <p className="mt-1 text-xs leading-5 text-[var(--color-muted)]">
                {tender.entity}{tender.location ? ` — ${toSentenceCase(tender.location)}` : ""}
                <br />
                Date limite : {tender.deadline || "à vérifier"}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-[var(--color-border-subtle)] pt-3 text-xs text-[var(--color-muted-light)]">
          Vous recevez cet e-mail car une de vos alertes est active.
        </p>
      </div>
    </AppWindow>
  );
}

// Real labels: eligibility topics (art. 27) and the first required documents of
// an open call for tenders (art. 28-31), as listed in the app's procedure guide.
const PREP_ELIGIBILITY = [
  { label: "Capacité juridique", done: true },
  { label: "Capacités techniques", done: true },
  { label: "Capacités financières", done: false },
] as const;
const PREP_DOCUMENTS = [
  { label: "Pouvoirs du signataire", done: true },
  { label: "Déclaration sur l'honneur (art. 29)", done: true },
  { label: "Dossier technique : moyens humains et techniques", done: true },
  { label: "Attestations de référence", done: false },
  { label: "CPS paraphé et signé", done: false },
] as const;

function CheckLine({ label, done }: { label: string; done: boolean }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {done ? (
        <Check size={16} className="shrink-0 text-[var(--color-success)]" aria-hidden="true" />
      ) : (
        <CircleDashed size={16} className="shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 truncate text-[var(--color-ink)]">{label}</span>
      <span className={`shrink-0 text-xs font-semibold ${done ? "text-[var(--color-success)]" : "text-[var(--color-muted)]"}`}>
        {done ? "Vérifié" : "À vérifier"}
      </span>
    </li>
  );
}

/** 03 — preparing one consultation: deadline, DCE, eligibility, documents. */
function PrepPanel({ tender, live }: { tender: Tender; live: boolean }) {
  const badge = deadlineBadge(tender.deadline);
  const done = PREP_DOCUMENTS.filter((d) => d.done).length;
  return (
    <AppWindow title="Préparation de la candidature" badge={<span className={`shrink-0 ${EXAMPLE_TAG}`}>Exemple illustratif</span>}>
      <div className="border-b border-[var(--color-border-subtle)] p-4 sm:p-5">
        <p className="line-clamp-2 text-sm font-bold leading-5 text-[var(--color-ink)]">{toSentenceCase(tender.title)}</p>
        <p className="mt-1 truncate text-xs text-[var(--color-muted)]">{tender.entity}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums ${badge.className}`}>
            <CalendarClock size={13} aria-hidden="true" />
            {badge.label}
          </span>
          <span className="text-xs tabular-nums text-[var(--color-muted)]">Date limite : {tender.deadline}</span>
          {live ? (
            <Link
              to={toTenderPath(tender.id)}
              className={`ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] no-underline hover:bg-[var(--color-surface-muted)] ${FOCUS}`}
            >
              <Download size={13} aria-hidden="true" /> DCE
            </Link>
          ) : (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)]">
              <Download size={13} aria-hidden="true" /> DCE
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 p-4 sm:grid-cols-2 sm:p-5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.06em] text-[var(--color-muted)]">
            <ShieldCheck size={14} aria-hidden="true" /> Éligibilité
          </p>
          <ul className="mt-2.5 space-y-2">
            {PREP_ELIGIBILITY.map((item) => <CheckLine key={item.label} {...item} />)}
          </ul>
        </div>
        <div className="min-w-0">
          <p className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-[0.06em] text-[var(--color-muted)]">
            <span className="inline-flex items-center gap-1.5"><ClipboardCheck size={14} aria-hidden="true" /> Pièces exigées</span>
            <span className="tabular-nums text-[var(--color-primary)]">{done}/{PREP_DOCUMENTS.length}</span>
          </p>
          <div className="mt-2"><Bar value={done} max={PREP_DOCUMENTS.length} /></div>
          <ul className="mt-2.5 space-y-2">
            {PREP_DOCUMENTS.map((item) => <CheckLine key={item.label} {...item} />)}
          </ul>
        </div>
      </div>
    </AppWindow>
  );
}

export function BenefitsSection({ stats, tenders, live }: { stats: StatsResponse | null; tenders: Tender[]; live: boolean }) {
  return (
    <section className={SECTION} aria-labelledby="home-why-title">
      <SectionHeader
        id="home-why-title"
        eyebrow="Pourquoi MP Maroc"
        title={<>Moins de veille, plus de <Pill>marchés gagnés</Pill>.</>}
      />
      <div className="mt-10 space-y-14 sm:space-y-20">
        <DemoRow
          index="01 — Trouver"
          title="Trouvez en minutes, pas en heures"
          text="Toutes les consultations au même endroit, au lieu de fouiller le portail secteur par secteur."
          points={["Recherche et filtres par secteur, ville, procédure et échéance", "Favoris, recherches enregistrées et export"]}
          visual={<FacetPanel stats={stats} live={live} />}
        />
        <DemoRow
          reverse
          index="02 — Être prévenu"
          title="Ne laissez plus passer une consultation"
          text="Chaque matin, les nouvelles consultations qui correspondent à vos critères arrivent dans votre boîte."
          points={["Critères par secteur, région, mots-clés et budget", "Un e-mail quotidien, sans doublon"]}
          visual={<EmailPreview tenders={tenders} live={live} />}
        />
        {tenders[0] && (
          <DemoRow
            index="03 — Préparer"
            title="Préparez votre candidature avec méthode"
            text="Une offre écartée pour une pièce manquante est une offre perdue. Vérifiez avant de vous engager."
            points={["Vérification d'éligibilité et pièces exigées par procédure", "Guide des procédures, assistant de candidature et accès au DCE"]}
            visual={<PrepPanel tender={tenders[0]} live={live} />}
          />
        )}
      </div>
    </section>
  );
}

/* ─── Avant / Avec MP Maroc ───────────────────────────────────────── */

const BEFORE = [
  "Ouvrir le portail",
  "Chercher secteur par secteur",
  "Ouvrir chaque avis",
  "Télécharger les dossiers",
  "Tout lire",
  "Trier à la main",
] as const;
const AFTER = [
  "Critères personnalisés",
  "Consultations filtrées",
  "Alertes quotidiennes",
  "Fiche structurée",
  "Vérification d'éligibilité",
  "Préparation guidée",
] as const;

export function BeforeAfterSection() {
  return (
    <section className={SECTION} aria-labelledby="home-compare-title">
      <SectionHeader
        id="home-compare-title"
        center
        eyebrow="Avant / après"
        title={<>La même veille, <Pill>sans le travail manuel</Pill>.</>}
      />
      <Reveal className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-[1.75rem] border border-dashed border-[var(--color-border)] p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--color-muted-light)]">Avant — recherche manuelle</p>
          <ol className="mt-5 space-y-3">
            {BEFORE.map((step, i) => (
              <li key={step} className="flex items-center gap-3 text-sm text-[var(--color-muted)]">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[var(--color-border)] text-[11px] font-bold tabular-nums">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <p className="mt-5 flex items-center gap-2 rounded-xl bg-[var(--color-danger-soft)] px-3.5 py-2.5 text-sm font-semibold text-[var(--color-danger)]">
            <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
            Et le risque de rater une échéance
          </p>
        </div>

        <div className="rounded-[1.75rem] border border-[var(--color-primary)] bg-[var(--color-surface)] p-6 shadow-card sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--color-primary)]">Avec MP Maroc</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {AFTER.map((item) => (
              <li key={item} className="flex items-center gap-3 rounded-xl bg-[var(--color-surface-muted)] px-3.5 py-3 text-sm font-semibold text-[var(--color-ink)]">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)]">
                  <Check size={14} aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-5 flex items-center gap-2 rounded-xl bg-[var(--color-success-soft)] px-3.5 py-2.5 text-sm font-semibold text-[var(--color-success)]">
            <Bell size={16} className="shrink-0" aria-hidden="true" />
            Les échéances arrivent jusqu'à vous
          </p>
        </div>
      </Reveal>
    </section>
  );
}

/* ─── Explorer les données ────────────────────────────────────────── */

const CATEGORY_TONE: Record<string, string> = {
  Fournitures: "bg-[var(--color-primary)]",
  Travaux: "bg-[var(--color-warning)]",
  Services: "bg-[var(--color-success)]",
};

const DIRECTORIES = [
  { to: "/stats", icon: BarChart3, label: "Statistiques", description: "Vue d'ensemble de la commande publique" },
  { to: "/cities", icon: MapPin, label: "Villes", description: "Consultations par ville" },
  { to: "/regions", icon: Map, label: "Régions", description: "Consultations par région" },
  { to: "/sectors", icon: Layers3, label: "Secteurs", description: "Consultations par secteur d'activité" },
] as const;

export function DataSection({ stats }: { stats: StatsResponse | null }) {
  const categories = stats?.by_category ?? [];
  const total = categories.reduce((sum, c) => sum + c.count, 0);
  const sectors = stats?.top_sectors.slice(0, 5) ?? [];
  const max = Math.max(1, ...sectors.map((s) => s.count));
  return (
    <section className={SECTION} aria-labelledby="home-explore-title">
      <SectionHeader
        id="home-explore-title"
        eyebrow="Explorer les données"
        title={<>La commande publique, <Pill>par angle</Pill>.</>}
      />

      {total > 0 && (
        <Reveal className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className={`p-6 ${FRAME}`}>
            <h3 className="text-sm font-bold text-[var(--color-ink)]">Répartition par catégorie</h3>
            <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={categories.map((c) => `${c.category} : ${c.count}`).join(", ")}>
              {categories.map((c) => (
                <span key={c.category} className={CATEGORY_TONE[c.category] ?? "bg-[var(--color-muted-light)]"} style={{ width: `${(c.count / total) * 100}%` }} />
              ))}
            </div>
            <ul className="mt-5 divide-y divide-[var(--color-border-subtle)]">
              {categories.map((c) => (
                <li key={c.category} className="flex items-center gap-3 py-3">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${CATEGORY_TONE[c.category] ?? "bg-[var(--color-muted-light)]"}`} aria-hidden="true" />
                  <span className="flex-1 text-sm font-semibold text-[var(--color-ink)]">{c.category}</span>
                  <span className="text-xs tabular-nums text-[var(--color-muted)]">{Math.round((c.count / total) * 100)} %</span>
                  <span className="w-14 text-right text-lg font-bold tabular-nums text-[var(--color-ink)]">{fmt(c.count)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={`p-6 ${FRAME}`}>
            <h3 className="text-sm font-bold text-[var(--color-ink)]">Secteurs les plus actifs</h3>
            <ul className="mt-4 space-y-3.5">
              {sectors.map((s) => (
                <li key={s.sector_code}>
                  <Link to={`/sectors/${encodeURIComponent(s.sector_code)}`} className={`group block no-underline ${FOCUS}`}>
                    <span className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-[var(--color-ink)] group-hover:text-[var(--color-primary)]">{s.sector_name}</span>
                      <span className="shrink-0 font-bold tabular-nums text-[var(--color-ink)]">{fmt(s.count)}</span>
                    </span>
                    <span className="mt-1.5 block"><Bar value={s.count} max={max} /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      )}

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[1.75rem] border border-[color-mix(in_srgb,var(--color-border-subtle)_80%,transparent)] bg-[var(--color-border-subtle)] shadow-card lg:grid-cols-4">
        {DIRECTORIES.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="group flex flex-col gap-3 bg-[var(--color-surface)] p-5 no-underline transition-colors hover:bg-[var(--color-surface-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-primary)] motion-reduce:transition-none sm:p-6"
          >
            <span className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <item.icon size={19} aria-hidden="true" />
              </span>
              <ArrowRight size={17} className="text-[var(--color-muted-light)] transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-base font-bold text-[var(--color-ink)]">{item.label}</span>
              <span className="mt-0.5 block text-sm leading-5 text-[var(--color-muted)]">{item.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ─── Pour qui ? ──────────────────────────────────────────────────── */

const AUDIENCES = [
  { icon: HardHat, title: "Entreprises de travaux", description: "Voirie, bâtiment, assainissement, aménagement.", category: "Travaux" },
  { icon: Ruler, title: "Bureaux d'études", description: "Études, maîtrise d'œuvre, ingénierie.", category: null },
  { icon: Package, title: "Fournisseurs", description: "Matériel, équipements, fournitures.", category: "Fournitures" },
  { icon: Briefcase, title: "Entreprises de services", description: "Maintenance, gardiennage, nettoyage, transport.", category: "Services" },
  { icon: Store, title: "PME", description: "Une veille complète, sans y consacrer un poste.", category: null },
] as const;

export function AudienceSection({ stats }: { stats: StatsResponse | null }) {
  const countOf = (category: string | null) => stats?.by_category.find((c) => c.category === category)?.count;
  return (
    <section className={SECTION} aria-labelledby="home-who-title">
      <SectionHeader
        id="home-who-title"
        eyebrow="Pour qui ?"
        title={<>Pensé pour ceux qui <Pill>répondent</Pill> aux marchés publics.</>}
      />
      <Reveal>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {AUDIENCES.map((item) => {
            const count = countOf(item.category);
            return (
              <li key={item.title} className={`flex gap-3 p-5 lg:flex-col ${FRAME}`}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                  <item.icon size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[var(--color-ink)]">{item.title}</h3>
                  <p className="mt-1 text-sm leading-5 text-[var(--color-muted)]">{item.description}</p>
                  {count !== undefined && (
                    <p className="mt-2 text-xs font-semibold tabular-nums text-[var(--color-primary)]">
                      {fmt(count)} consultations {item.category}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Reveal>
    </section>
  );
}

/* ─── FAQ + CTA final ─────────────────────────────────────────────── */

// Same answers as the full FAQ page — the objections that block a sign-up.
const FAQ = [
  { q: "Est-ce vraiment gratuit ?", a: "Oui. La création d'un compte et la consultation des avis sont gratuites." },
  {
    q: "Faut-il un compte pour consulter ?",
    a: "Le catalogue se parcourt librement. Le détail des consultations est réservé aux comptes enregistrés ; l'inscription se fait en quelques secondes.",
  },
  {
    q: "D'où viennent les données ?",
    a: "Les avis sont issus de sources publiques et structurés pour en faciliter la lecture. Seules les publications officielles des acheteurs publics font foi : vérifiez toujours l'avis sur le portail officiel avant toute démarche.",
  },
  {
    q: "Comment fonctionnent les alertes ?",
    a: "Vous définissez vos critères (secteurs, régions, mots-clés, budget) et recevez chaque jour par e-mail les nouvelles consultations qui y correspondent.",
  },
] as const;

export function FaqSection() {
  return (
    <section className={SECTION} aria-labelledby="home-faq-title">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <SectionHeader id="home-faq-title" eyebrow="Questions fréquentes" title={<>Avant de vous <Pill>lancer</Pill>.</>} />
          <Link to="/faq" className={`mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-primary)] ${FOCUS}`}>
            Toutes les questions
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className={`divide-y divide-[var(--color-border-subtle)] ${FRAME}`}>
          {FAQ.map((item) => (
            <details key={item.q} className="group">
              <summary className={`flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-base font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)] [&::-webkit-details-marker]:hidden ${FOCUS}`}>
                {item.q}
                <ChevronDown size={18} className="shrink-0 text-[var(--color-muted-light)] transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
              </summary>
              <p className="px-6 pb-5 text-sm leading-6 text-[var(--color-muted)]">{item.a}</p>
            </details>
          ))}
        </div>
      </div>

      <p className="mt-6 flex gap-3 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-5 py-4 text-sm leading-6 text-[var(--color-muted)]">
        <Building2 size={18} className="mt-0.5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-[var(--color-ink)]">Les publications officielles des acheteurs publics font foi.</strong>{" "}
          MP Maroc facilite la veille et la préparation et ne remplace pas la vérification sur le portail officiel.
        </span>
      </p>
    </section>
  );
}

export function FinalCta({ cta, showReassurance, sentinelRef }: { cta: PrimaryCta; showReassurance: boolean; sentinelRef: Ref<HTMLElement> }) {
  return (
    <section
      ref={sentinelRef}
      aria-labelledby="home-cta-title"
      className="mx-auto max-w-7xl rounded-[1.75rem] bg-[var(--color-primary)] px-6 py-14 text-center text-[var(--color-on-primary)] sm:px-10 sm:py-20"
    >
      <h2 id="home-cta-title" className="mx-auto max-w-3xl text-[clamp(1.75rem,3.6vw,3rem)] font-semibold leading-[1.1]">
        Votre prochaine opportunité est peut-être déjà publiée.
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-base leading-7 opacity-85 sm:text-lg">
        Définissez vos critères une fois. MP Maroc surveille les nouvelles publications et vous prévient chaque jour.
      </p>
      <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <Link
          to={cta.to}
          className={`inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--color-on-primary)] px-7 text-sm font-semibold text-[var(--color-primary)] no-underline transition-transform hover:-translate-y-0.5 motion-reduce:transition-none ${FOCUS}`}
        >
          {cta.label}
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
        <Link
          to="/tenders"
          className={`inline-flex h-12 items-center justify-center rounded-full border border-current px-7 text-sm font-semibold text-[var(--color-on-primary)] no-underline opacity-90 transition-transform hover:-translate-y-0.5 hover:opacity-100 motion-reduce:transition-none ${FOCUS}`}
        >
          Voir les consultations
        </Link>
      </div>
      {showReassurance && (
        <ul className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm opacity-85">
          {REASSURANCE.map((item) => (
            <li key={item} className="inline-flex items-center gap-1.5">
              <Check size={15} aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Mobile-only sticky bar: keeps the primary action one thumb away. */
export function StickyCta({ cta, visible }: { cta: PrimaryCta; visible: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border-subtle)] bg-[color-mix(in_srgb,var(--color-surface)_94%,transparent)] px-4 py-3 backdrop-blur transition-transform duration-300 motion-reduce:transition-none md:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <Link
        to={cta.to}
        tabIndex={visible ? 0 : -1}
        className={`flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] text-sm font-semibold text-[var(--color-on-primary)] no-underline ${FOCUS}`}
      >
        {cta.label}
        <ArrowUpRight size={17} className="text-[var(--color-warning)]" aria-hidden="true" />
      </Link>
    </div>
  );
}
