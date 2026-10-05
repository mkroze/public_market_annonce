import { useEffect, useRef } from "react";

// Poll `load` every `intervalMs` while `active` is true, then stop. This is the
// "refresh while a run is in progress" behaviour that was copy-pasted three
// times in the old Imports page — now shared by the three pipeline pages.
export function usePipelinePolling(load: () => void, active: boolean, intervalMs = 4000) {
  const ref = useRef<number | null>(null);
  useEffect(() => {
    if (!active) return;
    ref.current = window.setInterval(load, intervalMs);
    return () => {
      if (ref.current) window.clearInterval(ref.current);
    };
  }, [active, load, intervalMs]);
}
