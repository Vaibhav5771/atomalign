import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

interface MeteorsProps {
  number?: number;
  className?: string;
}

export function Meteors({ number = 20, className }: MeteorsProps) {
  const reducedMotion = usePrefersReducedMotion();

  const meteors = useMemo(
    () =>
      Array.from({ length: number }, (_, i) => ({
        id: i,
        // Start near the top edge, scattered horizontally with some bleed off-screen
        // so meteors can enter the viewport from above-left as the rotated motion sweeps them in.
        top: -10,
        left: Math.random() * 120 - 10,
        delay: Math.random() * 4,
        duration: 4 + Math.random() * 4,
      })),
    [number],
  );

  if (reducedMotion) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
      aria-hidden="true"
    >
      <style>{meteorKeyframes}</style>
      {meteors.map((m) => (
        <span
          key={m.id}
          className="absolute h-0.5 w-0.5 rounded-full"
          style={{
            top: `${m.top}%`,
            left: `${m.left}%`,
            background: "var(--neon-blue)",
            boxShadow:
              "0 0 0 1px color-mix(in oklch, var(--neon-blue) 30%, transparent)",
            animation: `meteor ${m.duration}s linear ${m.delay}s infinite`,
          }}
        >
          {/* Tail: extends to the right in the parent's local frame.
              Parent is rotated 215deg by the animation, so this becomes
              up-and-to-the-right in screen coordinates — i.e. behind the
              direction of motion. Do NOT add another rotate() here. */}
          <span
            className="absolute top-1/2 -z-10 h-px w-[60px] -translate-y-1/2"
            style={{
              background:
                "linear-gradient(90deg, var(--neon-blue), transparent)",
            }}
          />
        </span>
      ))}
    </div>
  );
}

const meteorKeyframes = `
@keyframes meteor {
  0% { transform: rotate(215deg) translateX(0); opacity: 1; }
  70% { opacity: 1; }
  100% { transform: rotate(215deg) translateX(-700px); opacity: 0; }
}
`;
