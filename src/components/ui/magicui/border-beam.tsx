import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

interface BorderBeamProps {
  size?: number;
  duration?: number;
  delay?: number;
  className?: string;
}

export function BorderBeam({
  size = 200,
  duration = 6,
  delay = 0,
  className,
}: BorderBeamProps) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return (
      <span
        className={cn(
          "pointer-events-none absolute inset-0 rounded-[inherit] border",
          className,
        )}
        style={{ borderColor: "color-mix(in oklch, var(--neon-blue) 60%, transparent)" }}
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]",
        className,
      )}
      aria-hidden="true"
    >
      <style>{borderBeamKeyframes}</style>
      <span
        className="absolute inset-0 rounded-[inherit]"
        style={{
          padding: "1px",
          background: `conic-gradient(from var(--beam-angle), transparent 0deg, var(--neon-blue) 30deg, var(--neon-violet) 60deg, transparent 90deg)`,
          WebkitMask:
            "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
          animation: `border-beam-rotate ${duration}s linear ${delay}s infinite`,
          // @ts-expect-error CSS custom property fallback
          "--beam-angle": "0deg",
          "--size": `${size}px`,
        }}
      />
    </span>
  );
}

const borderBeamKeyframes = `
@property --beam-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}
@keyframes border-beam-rotate {
  to { --beam-angle: 360deg; }
}
`;
