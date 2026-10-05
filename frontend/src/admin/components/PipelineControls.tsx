import type { ReactNode } from "react";
import { Play, Pause, Square } from "lucide-react";
import { GatedButton } from "./ui";
import type { SteerAction } from "../types";

// Run / Pause / Resume / Cancel cluster shared by the three pipeline pages.
// The Run button is permission-gated and disabled while a run is active; the
// Pause↔Resume toggle and Cancel appear only while a run is active.
export function PipelineControls({
  active, paused, canRun, onRun, onSteer, runLabel, runIcon,
  runningReason = "A run is already in progress",
}: {
  active: boolean;
  paused: boolean;
  canRun: boolean;
  onRun: () => void;
  onSteer: (action: SteerAction) => void;
  runLabel: string;
  runIcon: ReactNode;
  runningReason?: string;
}) {
  const permReason = "Requires imports.run permission";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <GatedButton
        allowed={canRun && !active}
        reason={active ? runningReason : permReason}
        onClick={onRun}
      >
        {runIcon} {runLabel}
      </GatedButton>

      {active && (
        <>
          <button
            onClick={() => canRun && onSteer(paused ? "resume" : "pause")}
            disabled={!canRun}
            title={!canRun ? permReason : undefined}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-sans rounded-lg border border-[var(--color-border-subtle)] hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-45 disabled:cursor-not-allowed"
          >
            {paused
              ? <><Play className="w-4 h-4" aria-hidden /> Resume</>
              : <><Pause className="w-4 h-4" aria-hidden /> Pause</>}
          </button>
          <button
            onClick={() => canRun && onSteer("cancel")}
            disabled={!canRun}
            title={!canRun ? permReason : undefined}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-sans rounded-lg border border-[var(--color-crimson)]/40 text-[var(--color-crimson)] hover:bg-[var(--color-crimson)]/5 focus-visible:ring-2 focus-visible:ring-[var(--color-crimson)] disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Square className="w-4 h-4" aria-hidden /> Cancel
          </button>
        </>
      )}
    </div>
  );
}
