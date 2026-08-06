import { useCallback, useState } from "react";
import { createToast, type ToastData } from "../../components/Toast";

export function useToasts() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const push = useCallback(
    (message: string, type: ToastData["type"] = "info", duration?: number) => {
      setToasts((prev) => [...prev, createToast(message, type, duration)]);
    },
    [],
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, push, dismiss };
}
