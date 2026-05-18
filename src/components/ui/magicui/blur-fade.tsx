import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-prefers-reduced-motion";

interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  /** Seconds to wait before starting the animation. Use to stagger multiple fades. */
  delay?: number;
  /** Animation duration in seconds. */
  duration?: number;
  /** Vertical offset (px) to start from. Set 0 for blur-only. */
  yOffset?: number;
  /** Blur amount, e.g. "6px". */
  blur?: string;
}

/**
 * Container-level fade-in with a soft blur. Used to soften tables and lists
 * on first paint without animating each row. Honours prefers-reduced-motion
 * by rendering a plain div with no transitions.
 */
export function BlurFade({
  children,
  className,
  delay = 0,
  duration = 0.4,
  yOffset = 6,
  blur = "6px",
}: BlurFadeProps) {
  const reducedMotion = usePrefersReducedMotion();

  if (reducedMotion) {
    return <div className={cn(className)}>{children}</div>;
  }

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: yOffset, filter: `blur(${blur})` }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ delay, duration, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
