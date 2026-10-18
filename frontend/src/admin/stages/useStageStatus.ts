// The load / poll-while-running / 403-vs-error dance every stage view needs.
// Extracted from the three pipeline pages, which each had their own copy.
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "../api";
import { usePipelinePolling } from "../hooks";

export interface StageStatus<T> {
  status: T | null;
  loading: boolean;
  error: ApiError | null;
  /** Re-read; pass true to show the full-page spinner instead of refreshing in place. */
  reload: (showSpinner?: boolean) => void;
}

export function useStageStatus<T>(
  fetcher: () => Promise<T>,
  isActive: (status: T | null) => boolean,
): StageStatus<T> {
  const [status, setStatus] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const reload = useCallback((showSpinner = false) => {
    if (showSpinner) setLoading(true);
    fetcher()
      .then((res) => { setStatus(res); setError(null); })
      .catch((e) => setError(e instanceof ApiError ? e : new ApiError(0, String(e))))
      .finally(() => setLoading(false));
    // fetcher is a module-level api function per stage; identity is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { reload(true); }, [reload]);
  usePipelinePolling(() => reload(false), isActive(status));

  return { status, loading, error, reload };
}
