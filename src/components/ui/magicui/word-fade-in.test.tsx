import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { WordFadeIn } from "./word-fade-in";
import { setReducedMotion } from "@/test/matchMedia";

describe("WordFadeIn", () => {
  beforeEach(() => setReducedMotion(false));

  it("splits the text into one span per word when motion is enabled", () => {
    const { container } = render(<WordFadeIn text="hello brave world" />);
    // The wrapping span contains one inline-block per word.
    const root = container.firstChild as HTMLElement;
    const wordSpans = root.querySelectorAll("span.inline-block");
    expect(wordSpans).toHaveLength(3);
    expect(wordSpans[0]).toHaveTextContent("hello");
    expect(wordSpans[2]).toHaveTextContent("world");
  });

  it("renders the full text in a single span when reduced motion is preferred", () => {
    setReducedMotion(true);
    const { container } = render(<WordFadeIn text="hello brave world" />);
    expect(container.firstChild).toHaveTextContent("hello brave world");
    const root = container.firstChild as HTMLElement;
    expect(root.querySelectorAll("span.inline-block")).toHaveLength(0);
  });
});
