import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { BlurFade } from "./blur-fade";
import { setReducedMotion } from "@/test/matchMedia";

describe("BlurFade", () => {
  beforeEach(() => setReducedMotion(false));

  it("renders its children", () => {
    const { getByText } = render(
      <BlurFade>
        <span>payload</span>
      </BlurFade>,
    );
    expect(getByText("payload")).toBeInTheDocument();
  });

  it("forwards a className to the root element", () => {
    const { container } = render(
      <BlurFade className="custom-x">
        <span>x</span>
      </BlurFade>,
    );
    expect(container.firstChild).toHaveClass("custom-x");
  });

  it("renders a plain div with no transform when reduced motion is preferred", () => {
    setReducedMotion(true);
    const { container } = render(
      <BlurFade>
        <span>payload</span>
      </BlurFade>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.tagName).toBe("DIV");
    // Plain div has no inline transform/opacity/filter applied.
    expect(root.style.transform).toBe("");
    expect(root.style.filter).toBe("");
  });

  it("uses a motion-driven element when motion is enabled", () => {
    const { container } = render(
      <BlurFade>
        <span>payload</span>
      </BlurFade>,
    );
    const root = container.firstChild as HTMLElement;
    // framer-motion applies inline style for animated properties; opacity
    // starts at 0 before the first frame.
    expect(root.style.opacity).not.toBe("");
  });
});
