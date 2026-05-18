import * as React from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

interface ShimmerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shimmerColor?: string;
  shimmerDuration?: string;
  background?: string;
  borderRadius?: string;
}

export const ShimmerButton = React.forwardRef<HTMLButtonElement, ShimmerButtonProps>(
  (
    {
      shimmerColor = "rgba(255, 255, 255, 0.9)",
      shimmerDuration = "2.5s",
      background = "var(--primary)",
      borderRadius = "0.375rem",
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const reducedMotion = usePrefersReducedMotion();

    return (
      <button
        ref={ref}
        style={
          {
            "--shimmer-color": shimmerColor,
            "--shimmer-duration": shimmerDuration,
            "--shimmer-bg": background,
            "--shimmer-radius": borderRadius,
          } as React.CSSProperties
        }
        className={cn(
          "relative inline-flex items-center justify-center overflow-hidden",
          "px-4 py-2 text-sm font-medium text-primary-foreground",
          "border border-white/10 shadow-[inset_0_-8px_10px_rgba(255,255,255,0.12)]",
          "transition-transform duration-150 active:translate-y-px",
          "disabled:pointer-events-none disabled:opacity-60",
          "[background:var(--shimmer-bg)] [border-radius:var(--shimmer-radius)]",
          className,
        )}
        {...props}
      >
        {!reducedMotion && (
          <>
            <style>{shimmerKeyframes}</style>
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 overflow-hidden [border-radius:inherit]"
            >
              <span
                className="absolute top-1/2 left-1/2 aspect-square w-[150%] -translate-x-1/2 -translate-y-1/2 animate-shimmer-button-spin"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, var(--shimmer-color) 30deg, transparent 60deg)",
                }}
              />
              <span
                aria-hidden="true"
                className="absolute inset-[1px] [background:var(--shimmer-bg)] [border-radius:inherit]"
              />
            </span>
          </>
        )}
        <span className="relative z-10 inline-flex items-center justify-center gap-1.5">
          {children}
        </span>
      </button>
    );
  },
);

ShimmerButton.displayName = "ShimmerButton";

const shimmerKeyframes = `
@keyframes shimmer-button-spin {
  to { transform: translate(-50%, -50%) rotate(360deg); }
}
.animate-shimmer-button-spin {
  animation: shimmer-button-spin var(--shimmer-duration, 2.5s) linear infinite;
}
`;
