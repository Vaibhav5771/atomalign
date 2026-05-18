import { cn } from "@/lib/utils";
import { BorderBeam } from "@/components/ui/magicui/border-beam";

interface AvatarBeamProps {
  initials: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  showBeam?: boolean;
  "aria-hidden"?: boolean;
}

const SIZES: Record<NonNullable<AvatarBeamProps["size"]>, string> = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

export function AvatarBeam({
  initials,
  size = "sm",
  className,
  showBeam = false,
  ...props
}: AvatarBeamProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium text-foreground",
        "bg-gradient-to-br from-[color-mix(in_oklch,var(--primary)_22%,transparent)] to-[color-mix(in_oklch,var(--neon-violet)_22%,transparent)]",
        "ring-1 ring-inset ring-primary/15",
        SIZES[size],
        className,
      )}
      {...props}
    >
      <span className="relative z-10 select-none tracking-wide">
        {initials}
      </span>
      {showBeam && <BorderBeam size={size === "lg" ? 80 : 40} duration={6} />}
    </span>
  );
}
