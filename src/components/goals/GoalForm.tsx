import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarIcon, Loader2, Lock } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Slider } from "@/components/ui/slider";
import { NumericStepper } from "@/components/shared/NumericStepper";
import { NumberTicker } from "@/components/ui/magicui/number-ticker";
import { AnimatedCircularProgress } from "@/components/ui/magicui/animated-circular-progress";
import { cn } from "@/lib/utils";
import type { Goal, GoalDraft, ScoreDirection, UoMType } from "@/types";

function formatLargeNumber(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "";
  if (Math.abs(n) >= 1_00_00_000) return `≈ ${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1_00_000) return `≈ ${(n / 1_00_000).toFixed(2)} L`;
  if (Math.abs(n) >= 1_000) return `≈ ${(n / 1_000).toFixed(1)} K`;
  return "";
}

const schema = z
  .object({
    thrust_area: z.string().min(1, "Required"),
    title: z.string().min(1, "Required"),
    description: z.string().optional(),
    uom: z.enum(["NUMERIC", "PERCENT", "TIMELINE", "ZERO"]),
    direction: z.enum(["HIGHER", "LOWER"]),
    target: z.string().min(1, "Required"),
    target_date: z.string().optional(),
    weightage: z
      .number({ message: "Whole numbers only" })
      .int("Whole numbers only")
      .min(10, "Minimum 10%")
      .max(100, "Maximum 100%"),
  })
  .superRefine((data, ctx) => {
    // TIMELINE goals MUST have a target_date — the score depends on it.
    if (data.uom === "TIMELINE" && !data.target_date?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["target_date"],
        message: "Target date is required for Timeline goals",
      });
    }
    // NUMERIC / PERCENT targets must parse as a positive number.
    if (data.uom === "NUMERIC" || data.uom === "PERCENT") {
      const n = Number(data.target);
      if (Number.isNaN(n) || n <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["target"],
          message: "Target must be a positive number",
        });
      }
    }
    // PERCENT target should be 0–100.
    if (data.uom === "PERCENT") {
      const n = Number(data.target);
      if (n > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["target"],
          message: "Percent target cannot exceed 100",
        });
      }
    }
  });

type FormValues = z.infer<typeof schema>;

interface Props {
  initial?: Partial<Goal>;
  onSubmit: (draft: GoalDraft) => Promise<void> | void;
  onCancel: () => void;
  submitLabel?: string;
}

const TARGET_HINTS: Record<UoMType, string> = {
  NUMERIC: "Enter a number — e.g. 50000000 for ₹5 Cr, 200 for units sold",
  PERCENT: "Enter a percent — e.g. 95 for 95% completion (no % sign)",
  TIMELINE: "Set the target date below — text Target field is auto-managed",
  ZERO: "Target is fixed at 0 — Zero-based goals succeed only when actual = 0",
};

const TARGET_PLACEHOLDER: Record<UoMType, string> = {
  NUMERIC: "e.g. 50000000",
  PERCENT: "e.g. 95",
  TIMELINE: "set the date →",
  ZERO: "0",
};

export function GoalForm({ initial, onSubmit, onCancel, submitLabel = "Add goal" }: Props) {
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      thrust_area: initial?.thrust_area ?? "",
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      uom: (initial?.uom as UoMType) ?? "NUMERIC",
      direction: (initial?.direction as ScoreDirection) ?? "HIGHER",
      target: initial?.target ?? "",
      target_date: initial?.target_date ?? "",
      weightage: initial?.weightage ?? 10,
    },
  });

  const uom = watch("uom");
  const direction = watch("direction");
  const targetValue = watch("target");
  const numericTarget = Number(targetValue) || 0;

  // Keep the text Target column sensible when UoM switches so users aren't
  // confused by stale values:
  //   ZERO     → fixed at "0" (target is implicit)
  //   TIMELINE → mirrors target_date string (so the row in the list reads well)
  useEffect(() => {
    if (uom === "ZERO") setValue("target", "0", { shouldValidate: true });
  }, [uom, setValue]);

  const targetDateValue = watch("target_date");
  useEffect(() => {
    if (uom === "TIMELINE" && targetDateValue) {
      setValue("target", targetDateValue, { shouldValidate: true });
    }
  }, [uom, targetDateValue, setValue]);

  const submit = handleSubmit(async (values) => {
    const requiresDirection = values.uom === "NUMERIC" || values.uom === "PERCENT";
    const draft: GoalDraft = {
      thrust_area: values.thrust_area,
      title: values.title,
      description: values.description?.trim() || null,
      uom: values.uom,
      target: values.target,
      target_date: values.target_date?.trim() ? values.target_date : null,
      weightage: values.weightage,
      is_shared: false,
      shared_by: null,
      direction: requiresDirection ? values.direction : "HIGHER",
    };
    await onSubmit(draft);
  });

  const showDirection = uom === "NUMERIC" || uom === "PERCENT";

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="thrust_area">Thrust area *</Label>
          <Input id="thrust_area" {...register("thrust_area")} placeholder="e.g. Revenue Growth" />
          {errors.thrust_area && (
            <p className="text-xs text-destructive">{errors.thrust_area.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="title">Goal title *</Label>
          <Input id="title" {...register("title")} placeholder="e.g. Achieve ₹5 Cr revenue" />
          {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" rows={2} {...register("description")} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="uom">Unit of measure *</Label>
          <Select
            value={uom}
            onValueChange={(v) => setValue("uom", v as UoMType, { shouldValidate: true })}
          >
            <SelectTrigger id="uom">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NUMERIC">Numeric (revenue, count, units)</SelectItem>
              <SelectItem value="PERCENT">Percent (completion %, NPS)</SelectItem>
              <SelectItem value="TIMELINE">Timeline (deadline-based)</SelectItem>
              <SelectItem value="ZERO">Zero-based (zero incidents = success)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{TARGET_HINTS[uom]}</p>
        </div>

        {/* NUMERIC — stepper + Indian numbering preview */}
        {uom === "NUMERIC" && (
          <div className="space-y-1">
            <Label htmlFor="target">Target *</Label>
            <NumericStepper
              id="target"
              value={targetValue}
              onChange={(v) => setValue("target", v, { shouldValidate: true })}
              placeholder="e.g. 50000000"
              className={cn(errors.target && "ring-1 ring-destructive/30 shadow-[0_0_18px_-8px_color-mix(in_oklch,var(--destructive)_55%,transparent)]")}
            />
            {errors.target && <p className="text-xs text-destructive">{errors.target.message}</p>}
            <div className={cn(
              "rounded-md border border-primary/30 bg-primary/[0.06] px-2.5 py-1.5",
              "shadow-[0_0_18px_-10px_color-mix(in_oklch,var(--primary)_55%,transparent)]",
            )}>
              <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">Preview</div>
              <div className="text-base font-semibold tabular-nums text-primary leading-tight">
                <NumberTicker value={numericTarget} />
              </div>
              {formatLargeNumber(numericTarget) && (
                <div className="text-[0.65rem] text-muted-foreground">{formatLargeNumber(numericTarget)}</div>
              )}
            </div>
          </div>
        )}

        {/* PERCENT — slider + circular progress */}
        {uom === "PERCENT" && (
          <div className="space-y-1">
            <Label htmlFor="target">Target percent *</Label>
            <div className={cn(
              "flex items-center gap-3 pt-1 rounded-md px-1",
              errors.target && "ring-1 ring-destructive/30 shadow-[0_0_18px_-8px_color-mix(in_oklch,var(--destructive)_55%,transparent)]",
            )}>
              <div className="flex-1 space-y-1.5">
                <Slider
                  id="target"
                  value={[Number(targetValue) || 0]}
                  min={0}
                  max={100}
                  step={10}
                  onValueChange={(v) => setValue("target", String(v[0] ?? 0), { shouldValidate: true })}
                />
                <div className="flex justify-between text-[0.6rem] text-muted-foreground tabular-nums px-1">
                  {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <AnimatedCircularProgress
                  value={Math.max(0, Math.min(100, Number(targetValue) || 0))}
                  size={48}
                  strokeWidth={5}
                  showValue={false}
                />
                <div className="w-12 text-right text-sm font-semibold tabular-nums text-primary">
                  <NumberTicker value={Math.max(0, Math.min(100, Number(targetValue) || 0))} suffix="%" />
                </div>
              </div>
            </div>
            {errors.target && <p className="text-xs text-destructive">{errors.target.message}</p>}
          </div>
        )}

        {/* TIMELINE — shadcn Calendar popover */}
        {uom === "TIMELINE" && (
          <div className="space-y-1">
            <Label htmlFor="target_date">Target deadline *</Label>
            <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="target_date"
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal h-9 rounded-sm",
                    !targetDateValue && "text-muted-foreground",
                    errors.target_date && "border-destructive/55 ring-1 ring-destructive/20 shadow-[0_0_18px_-8px_color-mix(in_oklch,var(--destructive)_55%,transparent)]",
                  )}
                >
                  <CalendarIcon className="h-3.5 w-3.5 mr-2 opacity-70" />
                  {targetDateValue ? format(new Date(targetDateValue), "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0">
                <Calendar
                  mode="single"
                  selected={targetDateValue ? new Date(targetDateValue) : undefined}
                  onSelect={(d) => {
                    if (!d) return;
                    const iso = format(d, "yyyy-MM-dd");
                    setValue("target_date", iso, { shouldValidate: true });
                    setValue("target", iso, { shouldValidate: true });
                    setDatePopoverOpen(false);
                  }}
                  disabled={(date) => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    return date < today;
                  }}
                  autoFocus
                />
              </PopoverContent>
            </Popover>
            {errors.target_date && (
              <p className="text-xs text-destructive">{errors.target_date.message}</p>
            )}
          </div>
        )}

        {/* ZERO — destructive locked panel */}
        {uom === "ZERO" && (
          <div className="space-y-1">
            <Label>Target (locked)</Label>
            <div className={cn(
              "relative flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/[0.07] px-3 py-2.5",
              "shadow-[0_0_18px_-10px_color-mix(in_oklch,var(--destructive)_55%,transparent)]",
            )}>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60 motion-safe:animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
              </span>
              <div className="text-3xl font-semibold tabular-nums text-destructive leading-none">0</div>
              <div className="flex-1">
                <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">Zero tolerance</div>
                <div className="text-xs text-muted-foreground">Locked at zero — any non-zero incident scores 0%.</div>
              </div>
              <Lock className="h-3.5 w-3.5 text-destructive/70" />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {showDirection && (
          <div className="space-y-1">
            <Label>Scoring direction *</Label>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Higher is better</span> — grow-metrics like revenue, NPS.{" "}
              <span className="font-medium">Lower is better</span> — shrink-metrics like cost, TAT, defects.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={direction === "HIGHER" ? "default" : "outline"}
                size="sm"
                className="flex-1 rounded-sm"
                onClick={() => setValue("direction", "HIGHER", { shouldValidate: true })}
                title="Score = Achievement ÷ Target. Use for grow-metrics like revenue or NPS."
              >
                Higher is better
              </Button>
              <Button
                type="button"
                variant={direction === "LOWER" ? "default" : "outline"}
                size="sm"
                className="flex-1 rounded-sm"
                onClick={() => setValue("direction", "LOWER", { shouldValidate: true })}
                title="Score = Target ÷ Achievement. Use for shrink-metrics like cost, TAT, or defects."
              >
                Lower is better
              </Button>
            </div>
          </div>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="weightage">Weightage (%) *</Label>
            <span className="text-xs text-muted-foreground">steps of 10 · minimum 10%</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1.5">
              <Slider
                id="weightage"
                value={[watch("weightage") || 10]}
                min={10}
                max={100}
                step={10}
                onValueChange={(v) => setValue("weightage", v[0] ?? 10, { shouldValidate: true })}
              />
              <div className="flex justify-between text-[0.6rem] text-muted-foreground tabular-nums px-1">
                {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 min-w-[110px] shrink-0">
              <AnimatedCircularProgress
                value={watch("weightage") || 10}
                size={36}
                strokeWidth={4}
                showValue={false}
              />
              <div className="leading-tight">
                <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">Share</div>
                <div className="text-sm font-semibold tabular-nums">
                  <NumberTicker value={watch("weightage") || 10} suffix="%" />
                </div>
              </div>
            </div>
          </div>
          {errors.weightage && (
            <p className="text-xs text-destructive">{errors.weightage.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Each goal must be at least 10%. All goals together must add up to exactly 100% before you can submit.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} className="rounded-sm">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="rounded-sm">
          {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
