import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

interface AnimatedGridPatternProps {
  width?: number;
  height?: number;
  numSquares?: number;
  maxOpacity?: number;
  duration?: number;
  className?: string;
}

interface Square {
  id: number;
  pos: [number, number];
}

export function AnimatedGridPattern({
  width = 40,
  height = 40,
  numSquares = 24,
  maxOpacity = 0.35,
  duration = 4,
  className,
}: AnimatedGridPatternProps) {
  const id = useId();
  const reducedMotion = usePrefersReducedMotion();
  const containerRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  const pickPos = (): [number, number] => [
    Math.floor((Math.random() * dimensions.width) / width),
    Math.floor((Math.random() * dimensions.height) / height),
  ];

  const generateSquares = (count: number): Square[] =>
    Array.from({ length: count }, (_, i) => ({ id: i, pos: pickPos() }));

  const [squares, setSquares] = useState<Square[]>([]);

  useEffect(() => {
    if (dimensions.width && dimensions.height) {
      setSquares(generateSquares(numSquares));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions, numSquares]);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setDimensions({
          width: e.contentRect.width,
          height: e.contentRect.height,
        });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const recycleSquare = (sqId: number) => {
    setSquares((curr) =>
      curr.map((s) => (s.id === sqId ? { ...s, pos: pickPos() } : s)),
    );
  };

  return (
    <svg
      ref={containerRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full fill-foreground/15 stroke-foreground/15",
        className,
      )}
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={-1}
          y={-1}
        >
          <path
            d={`M ${width} 0 L 0 0 0 ${height}`}
            fill="none"
            strokeWidth={0.6}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
      <svg x={0} y={0} className="overflow-visible">
        {!reducedMotion &&
          squares.map(({ pos: [x, y], id: sqId }, index) => (
            <motion.rect
              key={`${sqId}-${x}-${y}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: maxOpacity }}
              transition={{
                duration,
                repeat: 1,
                repeatType: "reverse",
                delay: index * 0.12,
                repeatDelay: 0.5,
              }}
              onAnimationComplete={() => recycleSquare(sqId)}
              width={width - 1}
              height={height - 1}
              x={x * width + 1}
              y={y * height + 1}
              fill="currentColor"
              strokeWidth={0}
            />
          ))}
      </svg>
    </svg>
  );
}
