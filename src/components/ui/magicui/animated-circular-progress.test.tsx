import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { AnimatedCircularProgress } from "./animated-circular-progress";
import { setReducedMotion } from "@/test/matchMedia";

describe("AnimatedCircularProgress", () => {
  beforeEach(() => setReducedMotion(false));

  it("renders the final percentage immediately under reduced motion", () => {
    setReducedMotion(true);
    const { container } = render(<AnimatedCircularProgress value={75} />);
    expect(container).toHaveTextContent("75%");
  });

  it("exposes ARIA progressbar semantics with min/max/now", () => {
    const { container } = render(
      <AnimatedCircularProgress value={40} label="Quarter progress" />,
    );
    const bar = container.querySelector("[role='progressbar']");
    expect(bar).not.toBeNull();
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAttribute("aria-label", "Quarter progress");
  });

  it("clamps values above the maximum", () => {
    setReducedMotion(true);
    const { container } = render(<AnimatedCircularProgress value={150} max={100} />);
    expect(container).toHaveTextContent("100%");
  });

  it("clamps values below zero", () => {
    setReducedMotion(true);
    const { container } = render(<AnimatedCircularProgress value={-10} />);
    expect(container).toHaveTextContent("0%");
  });

  it("hides the central value when showValue is false", () => {
    setReducedMotion(true);
    const { container } = render(
      <AnimatedCircularProgress value={60} showValue={false} />,
    );
    expect(container.textContent).not.toContain("%");
  });
});
