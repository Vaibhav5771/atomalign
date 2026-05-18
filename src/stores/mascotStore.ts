import { create } from "zustand";

export type MascotVariant = "idle" | "cheer" | "wave" | "concern";

interface MascotState {
  visible: boolean;
  message: string;
  variant: MascotVariant;
  timeoutId: number | null;
  show: (
    message: string,
    opts?: { variant?: MascotVariant; durationMs?: number },
  ) => void;
  hide: () => void;
}

export const useMascotStore = create<MascotState>((set, get) => ({
  visible: false,
  message: "",
  variant: "idle",
  timeoutId: null,

  show: (message, { variant = "idle", durationMs = 4000 } = {}) => {
    const prev = get().timeoutId;
    if (prev !== null) clearTimeout(prev);
    const id = window.setTimeout(
      () => set({ visible: false, timeoutId: null }),
      durationMs,
    );
    set({ visible: true, message, variant, timeoutId: id });
  },

  hide: () => {
    const prev = get().timeoutId;
    if (prev !== null) clearTimeout(prev);
    set({ visible: false, timeoutId: null });
  },
}));

export function useMascot() {
  const show = useMascotStore((s) => s.show);
  const hide = useMascotStore((s) => s.hide);
  return {
    say: (message: string, durationMs?: number) =>
      show(message, { durationMs }),
    cheer: (message: string, durationMs?: number) =>
      show(message, { variant: "cheer", durationMs }),
    wave: (message: string, durationMs?: number) =>
      show(message, { variant: "wave", durationMs }),
    concern: (message: string, durationMs?: number) =>
      show(message, { variant: "concern", durationMs }),
    hide,
  };
}
