import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Activity, ArrowUpRight, CalendarClock, Database, LockKeyhole, Play, SlidersHorizontal } from "lucide-react";
import { getOverview, getDceCache, getDceExtraction } from "../api";
import { fmtBytes } from "../components/ui";
import { usePipelinePolling } from "../hooks";
import { useStageContext } from "./useStageContext";
import { ScrapeControls, ScrapeData } from "./ScrapeViews";
import { DceCacheControls, DceCacheData } from "./DceCacheViews";
import { DceExtractionControls, DceExtractionData } from "./DceExtractionViews";
import StageScheduleCard from "./StageScheduleCard";
import FluxEtape from "./FluxEtape";
import { PipelineControls } from "../components/PipelineControls";

type Metric = { label: string; value: string | number; note: string };
const pendingMetrics: Metric[] = [
  { label: "Entrées", value: "—", note: "En attente de connexion" },
  { label: "Résultats", value: "—", note: "Aucun traitement disponible" },
  { label: "À traiter", value: "—", note: "Backend à connecter" },
  { label: "Dernière exécution", value: "—", note: "Pas encore d’exécution" },
];

function IndicateursEtape() {
  const { stage, workflow, refreshKey } = useStageContext();
  const [metrics, setMetrics] = useState<Metric[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    let request: Promise<Metric[]>;
    if (stage.slug === "scrape") {
      request = getOverview().then((r) => [
        { label: "Appels d’offres collectés", value: r.freshness.tender_count, note: "Catalogue enregistré" },
        { label: "Marchés actifs", value: r.freshness.active_tender_count, note: "Disponibles dans le catalogue" },
        { label: "Marchés expirés", value: r.failure_queues.stale_records, note: "Non archivés · à examiner" },
        { label: "Fiches détaillées", value: r.freshness.detail_count, note: "Liées à leur appel d’offres" },
      ]);
    } else if (stage.slug === "dce-cache") {
      request = getDceCache().then((r) => [
        { label: "Archives téléchargées", value: r.cached_total, note: "ZIP liés aux appels d’offres" },
        { label: "Stockage utilisé", value: fmtBytes(r.cached_bytes), note: r.cap_bytes ? `Capacité : ${fmtBytes(r.cap_bytes)}` : "Cache des dossiers" },
        { label: "Dernier lot · téléchargés", value: r.data[0]?.cached ?? "—", note: "Dernière exécution" },
        { label: "Dernier lot · erreurs", value: r.data[0]?.failed ?? "—", note: "À consulter dans le journal" },
      ]);
    } else if (stage.slug === "dce-extraction") {
      request = getDceExtraction().then((r) => [
        { label: "Résultats enregistrés", value: r.extracted_count, note: "Résultats réels uniquement" },
        { label: "Échantillons", value: r.simulated_count, note: "Simulations de démonstration" },
        { label: "Dernier lot · envoyés", value: r.data[0]?.enqueued ?? "—", note: "Dossiers envoyés à l’extraction" },
        { label: "Connexion n8n", value: r.simulate_enabled ? "À connecter" : "Configurée", note: "Prompt JSON → votre modèle" },
      ]);
    } else { setMetrics(pendingMetrics); return; }
    let current = true;
    request.then((r) => { if (current) { setMetrics(r); setFailed(false); } })
      .catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [stage.slug]);
  useEffect(load, [load, refreshKey, workflow?.active]);
  usePipelinePolling(load, workflow?.active ?? false);

  return (
    <section aria-label="Indicateurs" className="stage-metrics">
      {(metrics ?? pendingMetrics).map((m) => (
        <div className="stage-metric" key={m.label}>
          <span className="stage-eyebrow">{m.label}</span>
          <strong>{failed ? "—" : metrics ? (typeof m.value === "number" ? m.value.toLocaleString("fr-FR") : m.value) : "…"}</strong>
          <span className="stage-metric-note">{failed ? "Indicateur indisponible" : m.note}</span>
        </div>
      ))}
      {failed && <button className="stage-metrics-retry" onClick={load}>Réessayer les indicateurs</button>}
    </section>
  );
}

function Pane({ title, icon: Icon, children, className = "", aside }: {
  title: string; icon: typeof Activity; children: ReactNode; className?: string; aside?: ReactNode;
}) {
  return (
    <section aria-label={title} className={`stage-pane ${className}`}>
      <div className="stage-pane-heading"><h2><Icon size={16} aria-hidden />{title}</h2>{aside}</div>
      <div className="stage-pane-body">{children}</div>
    </section>
  );
}

const PLANNED_ACTIONS = {
  "video-generation": ["Générer une vidéo", "Relancer le rendu"],
  awards: ["Importer les résultats", "Vérifier les attributions"],
  campaigns: ["Préparer une campagne", "Envoyer la campagne"],
};

/** The same pane grid for every stage; only its contents change. */
export default function CadreEtape() {
  const { stage, reloadStatus } = useStageContext();
  const controls = stage.slug === "scrape" ? <ScrapeControls embedded />
    : stage.slug === "dce-cache" ? <DceCacheControls embedded />
    : stage.slug === "dce-extraction" ? <DceExtractionControls embedded />
    : <div>
        <PipelineControls active={false} paused={false} canRun={false}
          onRun={() => {}} onSteer={() => {}} runLabel="Backend à connecter"
          runIcon={<Play size={15} aria-hidden />} unavailableReason="Backend non disponible" onRefresh={reloadStatus} />
        <div className="stage-planned-actions">
        <p><LockKeyhole size={15} aria-hidden /> Backend non disponible</p>
        {PLANNED_ACTIONS[stage.slug as keyof typeof PLANNED_ACTIONS]?.map((label) => (
          <button key={label} disabled title="Cette action sera disponible après connexion du backend.">{label}<ArrowUpRight size={15} aria-hidden /></button>
        ))}
        </div>
      </div>;
  const output = stage.slug === "scrape" ? <ScrapeData />
    : stage.slug === "dce-cache" ? <DceCacheData />
    : stage.slug === "dce-extraction" ? <DceExtractionData />
    : <div className="stage-placeholder"><Database size={25} aria-hidden /><strong>Les résultats apparaîtront ici</strong><p>{stage.plannedNote}</p></div>;

  return (
    <div className="stage-workspace">
      <IndicateursEtape />
      <div className="stage-pane-grid">
        <Pane title="Commandes" icon={SlidersHorizontal} className="stage-commands" aside={<span className="stage-pane-caption">Vous gardez la main</span>}>
          {controls}
        </Pane>
        <Pane title="Flux en direct" icon={Activity} className="stage-feed" aside={<span className="stage-live-dot">{stage.planned ? "À connecter" : "Actualisation auto"}</span>}>
          <FluxEtape />
        </Pane>
        <Pane title="Planification" icon={CalendarClock} className="stage-schedules" aside={<span className="stage-pane-caption">Cette étape uniquement</span>}>
          <StageScheduleCard embedded />
        </Pane>
        <Pane title="Données de l’étape" icon={Database} className="stage-output" aside={<span className="stage-pane-caption">{stage.step === 1 ? "Catalogue des appels d’offres" : "Résultats de cette étape"}</span>}>
          {output}
        </Pane>
      </div>
    </div>
  );
}
