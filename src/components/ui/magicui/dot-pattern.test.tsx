import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DotPattern } from "./dot-pattern";

describe("DotPattern", () => {
  it("renders an SVG with a pattern definition and a filled rect", () => {
    const { container } = render(<DotPattern width={20} height={20} radius={1.5} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");

    const pattern = svg!.querySelector("pattern");
    expect(pattern).not.toBeNull();
    expect(pattern).toHaveAttribute("width", "20");
    expect(pattern).toHaveAttribute("height", "20");

    const circle = pattern!.querySelector("circle");
    expect(circle).toHaveAttribute("r", "1.5");

    const rect = svg!.querySelector("rect");
    expect(rect).toHaveAttribute("width", "100%");
    expect(rect).toHaveAttribute("height", "100%");
  });

  it("applies a custom className for masking", () => {
    const { container } = render(<DotPattern className="text-foreground/10" />);
    expect(container.querySelector("svg")).toHaveClass("text-foreground/10");
  });
});
