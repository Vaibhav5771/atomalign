import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NumericStepperProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  min?: number;
  className?: string;
  id?: string;
}

// Adaptive step size — small numbers nudge by 1, large numbers nudge by a
// round factor of their own magnitude so getting from 0 to 50,00,00,000 is
// possible without holding the button forever.
function stepFor(raw: number): number {
  const n = Math.abs(raw) || 1;
  const order = Math.floor(Math.log10(n));
  if (order <= 1) return 1;
  if (order <= 2) return 10;
  if (order <= 3) return 100;
  if (order <= 4) return 1_000;
  if (order <= 5) return 10_000;
  if (order <= 6) return 1_00_000;
  if (order <= 7) return 10_00_000;
  return 1_00_00_000;
}

export function NumericStepper({
  value,
  onChange,
  placeholder,
  min = 0,
  className,
  id,
}: NumericStepperProps) {
  const num = Number(value) || 0;
  const step = stepFor(num);

  const dec = () => {
    const next = Math.max(min, num - step);
    onChange(String(next));
  };
  const inc = () => {
    const next = num + step;
    onChange(String(next));
  };

  return (
    <div className={cn("flex items-stretch gap-1", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-sm"
        onClick={dec}
        aria-label="Decrease"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        step="any"
        min={min}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-center tabular-nums"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-9 w-9 shrink-0 rounded-sm"
        onClick={inc}
        aria-label="Increase"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
