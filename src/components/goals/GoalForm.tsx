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
import type { Goal, GoalDraft, UoMType } from "@/types";

const schema = z.object({
  thrust_area: z.string().min(1, "Required"),
  title: z.string().min(1, "Required"),
  description: z.string().optional(),
  uom: z.enum(["NUMERIC", "PERCENT", "TIMELINE", "ZERO"]),
  target: z.string().min(1, "Required"),
  target_date: z.string().optional(),
  weightage: z
    .number({ message: "Whole numbers only" })
    .int("Whole numbers only")
    .min(10, "Minimum 10%")
    .max(100, "Maximum 100%"),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  initial?: Partial<Goal>;
  onSubmit: (draft: GoalDraft) => Promise<void> | void;
  onCancel: () => void;
  submitLabel?: string;
}

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
      target: initial?.target ?? "",
      target_date: initial?.target_date ?? "",
      weightage: initial?.weightage ?? 10,
    },
  });

  const uom = watch("uom");

  const submit = handleSubmit(async (values) => {
    const draft: GoalDraft = {
      thrust_area: values.thrust_area,
      title: values.title,
      description: values.description?.trim() || null,
      uom: values.uom,
      target: values.target,
      target_date: values.target_date?.trim() ? values.target_date : null,
      weightage: values.weightage,
      is_shared: false,
    };
    await onSubmit(draft);
  });

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="thrust_area">Thrust area</Label>
          <Input id="thrust_area" {...register("thrust_area")} placeholder="e.g. Revenue Growth" />
          {errors.thrust_area && (
            <p className="text-xs text-destructive">{errors.thrust_area.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="title">Goal title</Label>
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
          <Label htmlFor="uom">Unit of measure</Label>
          <Select
            value={uom}
            onValueChange={(v) => setValue("uom", v as UoMType, { shouldValidate: true })}
          >
            <SelectTrigger id="uom">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NUMERIC">Numeric</SelectItem>
              <SelectItem value="PERCENT">Percent</SelectItem>
              <SelectItem value="TIMELINE">Timeline</SelectItem>
              <SelectItem value="ZERO">Zero target</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="target">Target</Label>
          <Input id="target" {...register("target")} placeholder="e.g. 50000000" />
          {errors.target && <p className="text-xs text-destructive">{errors.target.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {uom === "TIMELINE" && (
          <div className="space-y-1">
            <Label htmlFor="target_date">Target date</Label>
            <Input id="target_date" type="date" {...register("target_date")} />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="weightage">Weightage (%)</Label>
          <Input
            id="weightage"
            type="number"
            step={1}
            inputMode="numeric"
            aria-invalid={!!errors.weightage}
            {...register("weightage", { valueAsNumber: true })}
          />
          {errors.weightage && (
            <p className="text-xs text-destructive">{errors.weightage.message}</p>
          )}
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
