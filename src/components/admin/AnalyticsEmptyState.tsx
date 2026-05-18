import { Loader2, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedGridPattern } from "@/components/ui/magicui/animated-grid-pattern";
import { cn } from "@/lib/utils";

interface AnalyticsEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  className?: string;
}

export function AnalyticsEmptyState({
  icon: Icon,
  title,
  description,
  onRefresh,
  refreshing,
  className,
}: AnalyticsEmptyStateProps) {
  return (
    <div
      className={cn(
        "relative flex h-64 items-center justify-center overflow-hidden rounded-md border border-dashed border-border/60 bg-card",
        className,
      )}
    >
      <AnimatedGridPattern
        numSquares={18}
        maxOpacity={0.18}
        duration={3.5}
        className="[mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]"
      />
      <div className="relative z-10 flex max-w-sm flex-col items-center px-6 text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground shadow-sm">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
        {onRefresh && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="mt-4 rounded-sm bg-card"
          >
            {refreshing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        )}
      </div>
    </div>
  );
}
