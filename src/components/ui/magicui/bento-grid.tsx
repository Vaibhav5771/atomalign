import { cn } from "@/lib/utils";

interface BentoGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
}

export function BentoGrid({ children, className, ...rest }: BentoGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-min",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  /** Tailwind col-span and row-span classes — e.g. "md:col-span-2 md:row-span-2". */
  span?: string;
}

export function BentoCard({ children, className, span, ...rest }: BentoCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-lg border border-border bg-card p-4 overflow-hidden",
        span,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
