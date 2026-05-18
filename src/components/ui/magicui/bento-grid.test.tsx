import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { BentoGrid, BentoCard } from "./bento-grid";

describe("BentoGrid", () => {
  it("renders children inside a grid container", () => {
    const { container, getByText } = render(
      <BentoGrid>
        <div>cell-a</div>
        <div>cell-b</div>
      </BentoGrid>,
    );
    expect(container.firstChild).toHaveClass("grid");
    expect(getByText("cell-a")).toBeInTheDocument();
    expect(getByText("cell-b")).toBeInTheDocument();
  });

  it("forwards a custom className", () => {
    const { container } = render(<BentoGrid className="custom-x" />);
    expect(container.firstChild).toHaveClass("custom-x");
  });
});

describe("BentoCard", () => {
  it("applies the supplied span classes", () => {
    const { container } = render(
      <BentoCard span="md:col-span-2 md:row-span-2">x</BentoCard>,
    );
    expect(container.firstChild).toHaveClass("md:col-span-2");
    expect(container.firstChild).toHaveClass("md:row-span-2");
  });

  it("renders children", () => {
    const { getByText } = render(<BentoCard>hello</BentoCard>);
    expect(getByText("hello")).toBeInTheDocument();
  });
});
