import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useFocusRefresh } from "./use-focus-refresh";

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useFocusRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires when tab returns to foreground after the threshold", () => {
    const refresh = vi.fn();
    renderHook(() => useFocusRefresh(refresh, { thresholdMs: 1000 }));

    act(() => setVisibility("hidden"));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => setVisibility("visible"));

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not fire if the tab returns before the threshold", () => {
    const refresh = vi.fn();
    renderHook(() => useFocusRefresh(refresh, { thresholdMs: 1000 }));

    act(() => setVisibility("hidden"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => setVisibility("visible"));

    expect(refresh).not.toHaveBeenCalled();
  });

  it("fires when the browser comes back online while the tab is visible", () => {
    const refresh = vi.fn();
    renderHook(() => useFocusRefresh(refresh));

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not fire on online event when the tab is hidden", () => {
    const refresh = vi.fn();
    renderHook(() => useFocusRefresh(refresh));

    act(() => setVisibility("hidden"));
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  it("cleans up its listeners on unmount", () => {
    const refresh = vi.fn();
    const { unmount } = renderHook(() => useFocusRefresh(refresh));
    unmount();

    act(() => setVisibility("hidden"));
    act(() => setVisibility("visible"));
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  it("uses the latest callback reference between events", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(
      ({ cb }) => useFocusRefresh(cb, { thresholdMs: 1000 }),
      { initialProps: { cb: first } },
    );

    rerender({ cb: second });

    act(() => setVisibility("hidden"));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => setVisibility("visible"));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
