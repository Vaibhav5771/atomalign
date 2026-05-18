import { cn } from "@/lib/utils";

interface StatCardProps {
  className?: string;
  children: React.ReactNode;
}

export function StatCard({ className, children }: StatCardProps) {
  return (
    <div
      className={cn(
        "relative rounded-md border border-border/60 bg-card",
        className,
      )}
    >
      {children}
    </div>
  );
}
