import * as React from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

interface PulsatingButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pulseColor?: string;
  duration?: string;
}

export const PulsatingButton = React.forwardRef<
  HTMLButtonElement,
  PulsatingButtonProps
>(
  (
    {
      className,
      pulseColor = "color-mix(in oklch, var(--primary) 55%, transparent)",
      duration = "1.8s",
      children,
      ...props
    },
    ref,
  ) => {
    const reducedMotion = usePrefersReducedMotion();

    return (
      <>
        {!reducedMotion && <style>{pulseKeyframes}</style>}
        <button
          ref={ref}
          style={
            {
              "--pulse-color": pulseColor,
              "--pulse-duration": duration,
            } as React.CSSProperties
          }
          className={cn(
            "relative inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-transform active:translate-y-px disabled:pointer-events-none disabled:opacity-50",
            !reducedMotion && "animate-pulsate-button",
            className,
          )}
          {...props}
        >
          {children}
        </button>
      </>
    );
  },
);

PulsatingButton.displayName = "PulsatingButton";

const pulseKeyframes = `
@keyframes pulsate-button {
  0% { box-shadow: 0 0 0 0 var(--pulse-color); }
  100% { box-shadow: 0 0 0 12px transparent; }
}
.animate-pulsate-button {
  animation: pulsate-button var(--pulse-duration, 1.8s) ease-out infinite;
}
`;
