import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { BorderBeam } from "./border-beam";
import { setReducedMotion } from "@/test/matchMedia";

describe("BorderBeam", () => {
  beforeEach(() => setReducedMotion(false));

  it("renders an animated beam layer by default", () => {
    const { container } = render(<BorderBeam />);
    const animated = container.querySelector("span[style*='animation']");
    expect(animated).not.toBeNull();
  });

  it("renders a static border (no animation) when reduced motion is preferred", () => {
    setReducedMotion(true);
    const { container } = render(<BorderBeam />);
    const animated = container.querySelector("span[style*='animation']");
    expect(animated).toBeNull();
    // root span should still exist with a border style
    expect(container.firstChild).not.toBeNull();
  });

  it("marks itself aria-hidden so it does not pollute the a11y tree", () => {
    const { container } = render(<BorderBeam />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});
