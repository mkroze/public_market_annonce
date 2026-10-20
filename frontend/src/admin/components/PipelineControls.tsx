import { useState, type ReactNode } from "react";
import { Play, Pause, Square, RotateCcw, RefreshCw, Trash2, Archive, Download, Repeat2 } from "lucide-react";
import type { SteerAction } from "../types";

type MaintenanceAction = { onClick: () => void; disabled?: boolean; reason?: string; description: string };

/** Stable command positions across all six stages, including future backends. */
export function PipelineControls({
  active, paused, canRun, onRun, onSteer, runLabel, runIcon,
  runningReason = "Une exécution est déjà en cours", unavailableReason,
  onRefresh, cleanup, deleteData,
}: {
  active: boolean; paused: boolean; canRun: boolean;
  onRun: () => void; onSteer: (action: SteerAction) => void | Promise<void>;
  runLabel: string; runIcon: ReactNode;
  runningReason?: string; unavailableReason?: string;
  onRefresh?: () => void; cleanup?: MaintenanceAction; deleteData?: MaintenanceAction;
}) {
  const [pending, setPending] = useState(false);
  const permissionReason = "Autorisation imports.run requise";
  const futureReason = "Backend à connecter pour cette étape";
  async function steer(action: SteerAction) {
    if (!canRun || !active || pending) return;
    setPending(true);
    try { await onSteer(action); } finally { setPending(false); }
  }
  function maintenance(label: string, Icon: typeof Trash2, action?: MaintenanceAction, danger = false) {
    const reason = !action ? futureReason : action.disabled ? action.reason ?? "Action indisponible" : undefined;
    return <div className="pipeline-command-item">
      <button type="button" className={danger ? "pipeline-command danger" : "pipeline-command"}
        disabled={!action || action.disabled || pending} title={reason ?? action?.description} onClick={action?.onClick}>
        <Icon size={15} aria-hidden />{label}
      </button>
      <span>{reason ?? action?.description}</span>
    </div>;
  }
  return <div className="pipeline-command-center">
    <fieldset><legend>Exécution</legend><div className="pipeline-command-grid">
      <div className="pipeline-command-item"><button type="button" className="pipeline-command primary"
        disabled={!canRun || active || !!unavailableReason || pending}
        title={unavailableReason || (active ? runningReason : !canRun ? permissionReason : runLabel)} onClick={onRun}>
        {runIcon} Lancer une exécution
      </button><span>{unavailableReason || runLabel}</span></div>
      <div className="pipeline-command-item"><button type="button" className="pipeline-command"
        disabled={!canRun || !active || pending} title={!active ? "Aucune exécution active" : !canRun ? permissionReason : undefined}
        onClick={() => steer(paused ? "resume" : "pause")}>
        {paused ? <Play size={15} aria-hidden /> : <Pause size={15} aria-hidden />}{paused ? "Reprendre" : "Pause"}
      </button><span>{paused ? "Continuer l’exécution suspendue" : "Suspendre le traitement en cours"}</span></div>
      <div className="pipeline-command-item"><button type="button" className="pipeline-command danger"
        disabled={!canRun || !active || pending} title={!active ? "Aucune exécution active" : !canRun ? permissionReason : undefined}
        onClick={() => steer("cancel")}><Square size={15} aria-hidden />Annuler</button><span>Arrêter le traitement en cours</span></div>
    </div></fieldset>
    <fieldset><legend>Reprise et vérification</legend><div className="pipeline-command-grid">
      {maintenance("Relancer les erreurs", RotateCcw)}
      {maintenance("Retraiter les données", Repeat2)}
      {maintenance("Actualiser l’état", RefreshCw, onRefresh ? { onClick: onRefresh, description: "Relire les indicateurs, données et journal" } : undefined)}
    </div></fieldset>
    <fieldset><legend>Données de cette étape</legend><div className="pipeline-command-grid">
      {maintenance("Nettoyer les expirés", Archive, cleanup)}
      {maintenance("Supprimer les données", Trash2, deleteData, true)}
      {maintenance("Exporter les résultats", Download)}
    </div></fieldset>
  </div>;
}
