import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

interface GlobeProps {
  className?: string;
}

// City-like marker positions (x, y in 0-400 viewBox), with pulse delays for variety.
const MARKERS: Array<{ x: number; y: number; delay: number }> = [
  { x: 130, y: 140, delay: 0 },
  { x: 250, y: 110, delay: 0.6 },
  { x: 290, y: 220, delay: 1.2 },
  { x: 170, y: 240, delay: 1.8 },
  { x: 220, y: 180, delay: 2.4 },
  { x: 100, y: 200, delay: 3.0 },
];

export function Globe({ className }: GlobeProps) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div className={cn("relative aspect-square select-none", className)} aria-hidden="true">
      <style>{globeKeyframes}</style>

      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, color-mix(in oklch, var(--neon-blue) 28%, transparent), transparent 65%)",
        }}
      />

      <svg
        viewBox="0 0 400 400"
        className={cn(
          "relative w-full h-full text-foreground/40",
          !reducedMotion && "animate-globe-rotate",
        )}
      >
        <defs>
          <radialGradient id="globe-shade" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.05" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="globe-fade" cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="black" stopOpacity="1" />
            <stop offset="100%" stopColor="black" stopOpacity="0" />
          </radialGradient>
          <mask id="globe-mask">
            <rect width="400" height="400" fill="url(#globe-fade)" />
          </mask>
        </defs>

        <g mask="url(#globe-mask)">
          <circle cx="200" cy="200" r="180" fill="url(#globe-shade)" />
          <circle
            cx="200"
            cy="200"
            r="180"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.6"
          />

          {[40, 90, 140].map((ry) => (
            <ellipse
              key={`lat-${ry}`}
              cx="200"
              cy="200"
              rx="180"
              ry={ry}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity="0.35"
            />
          ))}
          <line
            x1="20"
            y1="200"
            x2="380"
            y2="200"
            stroke="currentColor"
            strokeWidth="0.8"
            opacity="0.5"
          />

          {[40, 90, 140].map((rx) => (
            <ellipse
              key={`lng-${rx}`}
              cx="200"
              cy="200"
              rx={rx}
              ry="180"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity="0.35"
            />
          ))}
          <line
            x1="200"
            y1="20"
            x2="200"
            y2="380"
            stroke="currentColor"
            strokeWidth="0.8"
            opacity="0.5"
          />
        </g>
      </svg>

      <svg
        viewBox="0 0 400 400"
        className="pointer-events-none absolute inset-0 w-full h-full"
      >
        {MARKERS.map((m, i) => (
          <g key={i}>
            <circle
              cx={m.x}
              cy={m.y}
              r="3"
              fill="var(--neon-blue)"
              style={
                reducedMotion
                  ? undefined
                  : {
                      transformOrigin: `${m.x}px ${m.y}px`,
                      animation: `globe-pulse 3s ease-out ${m.delay}s infinite`,
                    }
              }
            />
            <circle cx={m.x} cy={m.y} r="1.5" fill="white" />
          </g>
        ))}
      </svg>
    </div>
  );
}

const globeKeyframes = `
@keyframes globe-rotate {
  to { transform: rotate(360deg); }
}
.animate-globe-rotate {
  animation: globe-rotate 80s linear infinite;
}
@keyframes globe-pulse {
  0% { transform: scale(1); opacity: 0.9; }
  70% { transform: scale(4); opacity: 0; }
  100% { transform: scale(4); opacity: 0; }
}
`;
