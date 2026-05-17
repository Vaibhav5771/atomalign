import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
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
import type { Goal, GoalDraft, ScoreDirection, UoMType } from "@/types";

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
  const showTextTarget = uom === "NUMERIC" || uom === "PERCENT";
  const showDate = uom === "TIMELINE";

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

        {showTextTarget && (
          <div className="space-y-1">
            <Label htmlFor="target">Target *</Label>
            <Input
              id="target"
              type="number"
              inputMode="decimal"
              step="any"
              {...register("target")}
              placeholder={TARGET_PLACEHOLDER[uom]}
            />
            {errors.target && <p className="text-xs text-destructive">{errors.target.message}</p>}
          </div>
        )}

        {showDate && (
          <div className="space-y-1">
            <Label htmlFor="target_date">Target deadline *</Label>
            <Input id="target_date" type="date" {...register("target_date")} />
            {errors.target_date && (
              <p className="text-xs text-destructive">{errors.target_date.message}</p>
            )}
          </div>
        )}

        {uom === "ZERO" && (
          <div className="space-y-1">
            <Label htmlFor="target_zero">Target (auto-set)</Label>
            <Input
              id="target_zero"
              value="0"
              readOnly
              disabled
              tabIndex={-1}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Zero-based goals have a fixed target of 0. Check-in scores 100%
              only when actual = 0, otherwise 0%.
            </p>
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
                className="flex-1"
                onClick={() => setValue("direction", "HIGHER", { shouldValidate: true })}
                title="Score = Achievement ÷ Target. Use for grow-metrics like revenue or NPS."
              >
                Higher is better
              </Button>
              <Button
                type="button"
                variant={direction === "LOWER" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setValue("direction", "LOWER", { shouldValidate: true })}
                title="Score = Target ÷ Achievement. Use for shrink-metrics like cost, TAT, or defects."
              >
                Lower is better
              </Button>
            </div>
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="weightage">Weightage (%) *</Label>
          <Input
            id="weightage"
            type="number"
            step={1}
            min={10}
            max={100}
            inputMode="numeric"
            aria-invalid={!!errors.weightage}
            {...register("weightage", { valueAsNumber: true })}
          />
          {errors.weightage && (
            <p className="text-xs text-destructive">{errors.weightage.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Each goal must be at least 10%. All your goals together must add up to exactly 100% before you can submit.
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {isSubmitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
