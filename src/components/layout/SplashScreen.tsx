import { Loader2 } from "lucide-react";

export function SplashScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
