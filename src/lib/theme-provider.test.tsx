import { describe, it, expect } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./theme-provider";

function ThemeProbe() {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>toggle</button>
      <button onClick={() => setTheme("light")}>force-light</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  it("defaults to dark mode on first load", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("persists theme choice to localStorage", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    act(() => {
      screen.getByText("force-light").click();
    });
    expect(window.localStorage.getItem("atomalign-theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("reads persisted theme on next mount", () => {
    window.localStorage.setItem("atomalign-theme", "light");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
  });

  it("toggleTheme flips between dark and light", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    act(() => {
      screen.getByText("toggle").click();
    });
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    act(() => {
      screen.getByText("toggle").click();
    });
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("useTheme throws when used outside ThemeProvider", () => {
    expect(() => renderHook(() => useTheme())).toThrow(
      /useTheme must be used within ThemeProvider/,
    );
  });
});
