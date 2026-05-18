import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useMascotStore } from "@/stores/mascotStore";

const MASCOT_SRC = "/mascot.lottie";

export function Mascot() {
  const visible = useMascotStore((s) => s.visible);
  const message = useMascotStore((s) => s.message);
  const hide = useMascotStore((s) => s.hide);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.92 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="pointer-events-none fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2"
          aria-live="polite"
        >
          {message && (
            <div className="pointer-events-auto relative max-w-[260px] rounded-lg border border-border/60 bg-card px-3 py-2 pr-7 text-xs text-foreground shadow-lg">
              {message}
              <button
                type="button"
                onClick={hide}
                aria-label="Dismiss mascot"
                className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="pointer-events-auto h-24 w-24">
            <DotLottieReact src={MASCOT_SRC} loop autoplay />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
