import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getOverview, getImports, getDceCache, getDceExtraction, ApiError } from "../api";
import type { AdminOverview } from "../types";
import { PageHeader } from "../components/ui";
import { LoadingState, FailedState, DeniedState } from "../components/StateBlock";
import PipelineDiagram, { type PipelineSnapshot } from "../components/PipelineDiagram";
import WorkflowJournal from "./WorkflowJournal";

export default function Dashboard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<AdminOverview | null>(null);
  const [pipeline, setPipeline] = useState<PipelineSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    getOverview()
      .then(setData)
      .catch((e) => setError(e))
      .finally(() => setLoading(false));
    // Keep available stages visible if one service is unavailable.
    Promise.allSettled([getImports(), getDceCache(), getDceExtraction()])
      .then(([imp, cache, ext]) => setPipeline({
        imports: imp.status === "fulfilled" ? imp.value : null,
        cache: cache.status === "fulfilled" ? cache.value : null,
        extraction: ext.status === "fulfilled" ? ext.value : null,
      }));
  }

  useEffect(load, []);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Tender lifecycle and activity journal."
        actions={<button onClick={() => { load(); setRefreshKey((key) => key + 1); }} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--color-border-subtle)] bg-white px-3 text-sm font-semibold hover:bg-[var(--color-surface-muted)]"><RefreshCw className="h-4 w-4" aria-hidden />Refresh</button>}
      />
      {loading ? <LoadingState label="Loading pipeline" />
        : error?.status === 403 ? <DeniedState message={error.message} />
        : error || !data ? <FailedState message={error?.message} onRetry={load} />
        : <PipelineDiagram total={data.freshness.tender_count} snapshot={pipeline} />}
      <WorkflowJournal refreshKey={refreshKey} />
    </div>
  );
}
