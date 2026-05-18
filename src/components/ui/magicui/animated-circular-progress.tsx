import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

interface AnimatedCircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  label?: string;
  showValue?: boolean;
  duration?: number;
}

export function AnimatedCircularProgress({
  value,
  max = 100,
  size = 96,
  strokeWidth = 8,
  className,
  label,
  showValue = true,
  duration = 800,
}: AnimatedCircularProgressProps) {
  const reducedMotion = usePrefersReducedMotion();
  const target = Math.max(0, Math.min(max, value));
  const [animated, setAnimated] = useState(reducedMotion ? target : 0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (reducedMotion) {
      setAnimated(target);
      return;
    }
    if (hasAnimated.current) {
      setAnimated(target);
      return;
    }
    hasAnimated.current = true;

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimated(target * eased);
      if (progress < 1) raf = requestAnimationFrame(tick);
      else setAnimated(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reducedMotion]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / max) * circumference;
  const pct = Math.round((animated / max) * 100);

  return (
    <div
      className={cn("relative inline-flex flex-col items-center justify-center", className)}
      role="progressbar"
      aria-valuenow={target}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted/40"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--neon-blue)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            filter:
              "drop-shadow(0 0 4px color-mix(in oklch, var(--neon-blue) 50%, transparent))",
          }}
        />
      </svg>
      {showValue && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-semibold tabular-nums">{pct}%</span>
        </div>
      )}
    </div>
  );
}
