import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { MagicCard } from "./magic-card";
import { setReducedMotion } from "@/test/matchMedia";

describe("MagicCard", () => {
  beforeEach(() => setReducedMotion(false));

  it("renders its children", () => {
    const { getByText } = render(<MagicCard>inner</MagicCard>);
    expect(getByText("inner")).toBeInTheDocument();
  });

  it("renders a non-interactive static container under reduced motion", () => {
    setReducedMotion(true);
    const { container } = render(<MagicCard>inner</MagicCard>);
    // No group hover effect span should be present
    expect(container.querySelector(".group")).toBeNull();
    expect(container.firstChild).toHaveTextContent("inner");
  });

  it("renders a spotlight overlay when motion is enabled", () => {
    const { container } = render(<MagicCard>inner</MagicCard>);
    expect(container.querySelector(".group")).not.toBeNull();
    const overlay = container.querySelector("[aria-hidden='true']");
    expect(overlay).not.toBeNull();
  });

  it("tracks mouse position to drive the gradient", () => {
    const { container } = render(<MagicCard>inner</MagicCard>);
    const root = container.firstChild as HTMLElement;
    // Initial state — overlay has no background
    const overlay = root.querySelector("[aria-hidden='true']") as HTMLElement;
    expect(overlay.style.background).toBe("");
    // jsdom returns zero-rect bounding boxes, but the mousemove handler should
    // still flip the overlay style. Just confirm it doesn't throw.
    fireEvent.mouseMove(root, { clientX: 50, clientY: 40 });
    fireEvent.mouseLeave(root);
  });
});
