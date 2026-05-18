import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { NumberTicker } from "./number-ticker";
import { setReducedMotion } from "@/test/matchMedia";

describe("NumberTicker", () => {
  beforeEach(() => setReducedMotion(false));

  it("renders the final value immediately when reduced motion is preferred", () => {
    setReducedMotion(true);
    const { container } = render(<NumberTicker value={42} />);
    expect(container.firstChild).toHaveTextContent("42");
  });

  it("includes the accessible label with prefix/suffix for screen readers", () => {
    setReducedMotion(true);
    const { container } = render(<NumberTicker value={75} prefix="$" suffix="%" />);
    expect(container.firstChild).toHaveAttribute("aria-label", "$75%");
  });

  it("renders the starting value (0) on first paint when motion is on", () => {
    const { container } = render(<NumberTicker value={50} />);
    // Before any rAF tick runs, the displayed text is the start value.
    expect(container.firstChild?.textContent).toMatch(/^0/);
  });

  it("respects decimals prop", () => {
    setReducedMotion(true);
    const { container } = render(<NumberTicker value={3.14159} decimals={2} />);
    expect(container.firstChild).toHaveTextContent("3.14");
  });
});
