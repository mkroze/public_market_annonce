// Typed accessor for what StageShell hands its routed views: which stage is
// open, its live workflow state (null for planned stages), and a way to ask the
// shell to re-read that state after an action.
import { useOutletContext } from "react-router-dom";
import type { WorkflowState } from "../types";
import type { StageDescriptor } from "./registry";

export interface StageContext {
  stage: StageDescriptor;
  workflow: WorkflowState | null;
  /** Re-read the shell's status pill — call after run/pause/cancel. */
  reloadStatus: () => void;
  refreshKey: number;
}

export const useStageContext = (): StageContext => useOutletContext<StageContext>();
