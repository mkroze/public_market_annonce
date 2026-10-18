// Stands in for all three views of a stage that has no implementation yet, so
// stages 04–06 are walkable and self-describing instead of dead links. The copy
// comes from the stage descriptor, so there is one place to edit it.
import { EmptyState } from "../components/StateBlock";
import { useStageContext } from "./useStageContext";

export default function PlannedView() {
  const { stage } = useStageContext();
  return (
    <EmptyState
      title="Planned"
      hint={stage.plannedNote ?? "This stage is planned but not yet available. Nothing runs here."}
    />
  );
}
