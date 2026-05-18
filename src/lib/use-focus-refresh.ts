import { useEffect, useRef } from "react";

interface FocusRefreshOptions {
  /** Minimum hidden duration (ms) before a return-to-focus triggers a refresh. */
  thresholdMs?: number;
}

/**
 * Calls `refresh()` when the tab returns to foreground after being hidden for
 * at least `thresholdMs` (default 30s), or when the browser comes back online
 * while the tab is currently visible. Phase 0 safety net for the
 * "loading spinner stuck after tab switch" bug.
 */
export function useFocusRefresh(
  refresh: () => void | Promise<void>,
  opts?: FocusRefreshOptions,
): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const hiddenAtRef = useRef<number | null>(null);
  const threshold = opts?.thresholdMs ?? 30_000;

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        return;
      }
      if (document.visibilityState === "visible" && hiddenAtRef.current != null) {
        const awayMs = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
        if (awayMs >= threshold) void refreshRef.current();
      }
    };
    const onOnline = () => {
      if (document.visibilityState === "visible") void refreshRef.current();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [threshold]);
}
