import { useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

interface MagicCardProps {
  children: React.ReactNode;
  className?: string;
  gradientSize?: number;
  gradientColor?: string;
  gradientOpacity?: number;
}

export function MagicCard({
  children,
  className,
  gradientSize = 200,
  gradientColor = "var(--neon-blue)",
  gradientOpacity = 0.15,
}: MagicCardProps) {
  const reducedMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const onMouseLeave = useCallback(() => setPos(null), []);

  if (reducedMotion) {
    return (
      <div className={cn("relative rounded-lg border border-border bg-card", className)}>
        {children}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-card transition-colors",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={
          pos
            ? {
                background: `radial-gradient(${gradientSize}px circle at ${pos.x}px ${pos.y}px, color-mix(in oklch, ${gradientColor} ${gradientOpacity * 100}%, transparent), transparent 70%)`,
              }
            : undefined
        }
      />
      <div className="relative">{children}</div>
    </div>
  );
}
