import { useCallback, useEffect, useState } from "react";
import { Activity, CheckCircle2, CircleAlert, RefreshCw, CirclePause } from "lucide-react";
import { getWorkflowEvents } from "../api";
import type { WorkflowEvent } from "../types";
import { fmtDate } from "../components/ui";
import { usePipelinePolling } from "../hooks";
import { useStageContext } from "./useStageContext";
import { stageWorkflowKeys } from "./registry";

export default function FluxEtape() {
  const { stage, workflow, refreshKey } = useStageContext();
  const keys = stageWorkflowKeys(stage).join(",");
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [error, setError] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const load = useCallback(() => {
    if (!keys) return;
    let current = true;
    getWorkflowEvents({ workflow: keys, page: "1", per_page: "6" })
      .then((r) => { if (current) { setEvents(r.data); setLoadedAt(new Date()); setError(false); } })
      .catch(() => { if (current) setError(true); });
    return () => { current = false; };
  }, [keys]);
  useEffect(load, [load, refreshKey, workflow?.active]);
  // Also observes scheduled jobs and events started by another administrator.
  usePipelinePolling(load, !!keys, 5000);
  const progress = Object.entries(workflow?.progress ?? {});

  return (
    <div className="stage-stream">
      <div className={`stage-stream-status ${workflow?.active ? "is-running" : ""}`} role="status">
        <Activity size={17} aria-hidden />
        <div><strong>{stage.planned ? "En attente de connexion" : error ? "Connexion au journal interrompue" : workflow?.active ? workflow.paused ? "Exécution en pause" : "Traitement en cours" : "Prêt pour la prochaine action"}</strong>
          <p>{stage.planned ? "Les événements apparaîtront quand le backend sera disponible." : error ? "Impossible de récupérer les événements. Réessayez." : loadedAt ? `Mis à jour à ${loadedAt.toLocaleTimeString("fr-FR")} · toutes les 5 s` : "Connexion au journal…"}</p>
        </div>
        {!stage.planned && <button onClick={load} aria-label="Actualiser le flux" title="Actualiser le flux"><RefreshCw size={15} aria-hidden /></button>}
      </div>
      {progress.length > 0 && <div className="stage-progress-counters">{progress.map(([k, v]) => <span key={k}>{k.replace(/_/g, " ")}<strong>{v.toLocaleString("fr-FR")}</strong></span>)}</div>}
      {events.length > 0 ? <ol className="stage-event-list">{events.map((event) => {
        const failed = event.status === "failed" || event.status === "failure";
        const successful = ["done", "ok", "success"].includes(event.status);
        const running = event.status === "running";
        return <li key={event.id}>
          <span className={`stage-event-icon ${failed ? "is-error" : successful ? "is-success" : "is-pending"}`}>{failed || event.status === "partial" ? <CircleAlert size={15} aria-hidden /> : successful ? <CheckCircle2 size={15} aria-hidden /> : running ? <Activity size={15} aria-hidden /> : <CirclePause size={15} aria-hidden />}</span>
          <div><strong>{event.action.replace(/[._]/g, " ")}</strong><p>{event.error || Object.entries(event.details ?? {}).filter(([, v]) => typeof v === "number").map(([k, v]) => `${k.replace(/_/g, " ")} : ${v}`).join(" · ") || event.status}</p><time dateTime={event.at}>{fmtDate(event.at)} · {event.origin === "scheduled" ? "Planifié" : event.origin === "manual" ? "Manuel" : "Système"}</time></div>
          <span className="stage-event-result">{event.status}</span>
        </li>;
      })}</ol> : !error && <div className="stage-stream-empty"><span className="stage-stream-lines" aria-hidden><i /><i /><i /></span><p>Aucune activité enregistrée pour cette étape.</p><span>Lancez une action pour suivre son résultat ici.</span></div>}
    </div>
  );
}
