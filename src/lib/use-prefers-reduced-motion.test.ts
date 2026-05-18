import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { setReducedMotion } from "@/test/matchMedia";

describe("usePrefersReducedMotion", () => {
  beforeEach(() => {
    setReducedMotion(false);
  });

  it("returns false when the user has no motion preference", () => {
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true when prefers-reduced-motion: reduce matches", () => {
    setReducedMotion(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });
});
