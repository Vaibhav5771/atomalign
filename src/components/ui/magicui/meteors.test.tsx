import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { Meteors } from "./meteors";
import { setReducedMotion } from "@/test/matchMedia";

describe("Meteors", () => {
  beforeEach(() => setReducedMotion(false));

  it("renders the requested number of meteor elements", () => {
    const { container } = render(<Meteors number={12} />);
    const meteors = container.querySelectorAll("span[style*='animation']");
    expect(meteors).toHaveLength(12);
  });

  it("renders nothing when reduced motion is preferred", () => {
    setReducedMotion(true);
    const { container } = render(<Meteors number={10} />);
    expect(container.firstChild).toBeNull();
  });

  it("marks the container as aria-hidden so it is invisible to screen readers", () => {
    const { container } = render(<Meteors number={3} />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});
