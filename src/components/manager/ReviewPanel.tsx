import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { NumberTicker } from "@/components/ui/magicui/number-ticker";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Lock, Loader2, Check, Pencil } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Goal } from "@/types";

interface Props {
  goals: Goal[];
  readOnly: boolean;
  onInlineUpdate: (id: string, patch: Partial<Goal>) => Promise<{ error: string | null }>;
}

type Status = "idle" | "saving" | "saved" | "error";

function InlineNumber({
  value,
  disabled,
  min,
  max,
  onCommit,
}: {
  value: number;
  disabled: boolean;
  min?: number;
  max?: number;
  onCommit: (v: number) => Promise<{ error: string | null }>;
}) {
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<Status>("idle");

  const commitValue = async (n: number) => {
    if (!Number.isFinite(n) || n === value) return;
    if (min !== undefined && n < min) { setDraft(value); return; }
    if (max !== undefined && n > max) { setDraft(value); return; }
    setStatus("saving");
    const { error } = await onCommit(n);
    if (error) {
      setStatus("error");
      setDraft(value);
    } else {
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1200);
    }
  };

  return (
    <div className="flex items-center gap-2 min-w-[150px]">
      <Slider
        value={[draft]}
        min={min ?? 10}
        max={max ?? 100}
        step={10}
        disabled={disabled || status === "saving"}
        onValueChange={(v) => setDraft(v[0] ?? draft)}
        onValueCommit={(v) => void commitValue(v[0] ?? draft)}
        className={cn("flex-1", disabled && "opacity-50")}
      />
      <span className={cn(
        "text-sm font-semibold tabular-nums w-10 text-right shrink-0",
        disabled ? "text-muted-foreground" : "text-primary",
      )}>
        <NumberTicker value={draft} suffix="%" />
      </span>
      {status === "saving" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      {status === "saved" && <Check className="h-3 w-3 text-primary" />}
    </div>
  );
}

function InlineText({
  value,
  disabled,
  onCommit,
}: {
  value: string;
  disabled: boolean;
  onCommit: (v: string) => Promise<{ error: string | null }>;
}) {
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<Status>("idle");

  const commit = async () => {
    if (draft === value) return;
    if (!draft.trim()) {
      setDraft(value);
      return;
    }
    setStatus("saving");
    const { error } = await onCommit(draft);
    if (error) {
      setStatus("error");
      setDraft(value);
    } else {
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1200);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Input
        disabled={disabled || status === "saving"}
        value={draft}
        aria-label="Target"
        title={disabled ? "Read-only" : "Click to edit, blur to save"}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        className={
          "h-8 " +
          (disabled ? "" : "border-primary/40 bg-background focus:border-primary")
        }
      />
      {status === "saving" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      {status === "saved" && <Check className="h-3 w-3 text-primary" />}
    </div>
  );
}

function InlineDate({
  value,
  disabled,
  onCommit,
}: {
  value: string;
  disabled: boolean;
  onCommit: (v: string) => Promise<{ error: string | null }>;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");

  const commit = async (iso: string) => {
    if (iso === value) return;
    setStatus("saving");
    const { error } = await onCommit(iso);
    if (error) {
      setStatus("error");
    } else {
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1200);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Popover open={open && !disabled} onOpenChange={(o) => !disabled && setOpen(o)}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || status === "saving"}
            className={cn(
              "h-8 justify-start text-left font-normal text-sm rounded-sm",
              !disabled && "border-primary/40 bg-background hover:border-primary",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-3 w-3 mr-1.5 opacity-60" />
            {value ? format(new Date(value), "dd MMM yyyy") : "Pick date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="p-0">
          <Calendar
            mode="single"
            selected={value ? new Date(value) : undefined}
            onSelect={(d) => {
              if (!d) return;
              const iso = format(d, "yyyy-MM-dd");
              setOpen(false);
              void commit(iso);
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {status === "saving" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      {status === "saved" && <Check className="h-3 w-3 text-primary" />}
    </div>
  );
}

export function ReviewPanel({ goals, readOnly, onInlineUpdate }: Props) {
  const total = goals.reduce((s, g) => s + g.weightage, 0);

  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/[0.08] px-3 py-2 text-xs">
          <Pencil className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>
            Click the highlighted <span className="font-medium text-foreground">Target</span> or{" "}
            <span className="font-medium text-foreground">Weightage</span> cells to edit. Changes
            save automatically when you click away.
          </span>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[16%]">Thrust area</TableHead>
            <TableHead>Goal</TableHead>
            <TableHead className="w-[10%]">UoM</TableHead>
            <TableHead className="w-[18%]">
              <span className="inline-flex items-center gap-1">
                Target {!readOnly && <Pencil className="h-3 w-3 text-primary" />}
              </span>
            </TableHead>
            <TableHead className="w-[14%]">
              <span className="inline-flex items-center gap-1">
                Weightage {!readOnly && <Pencil className="h-3 w-3 text-primary" />}
              </span>
            </TableHead>
            <TableHead className="w-[40px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {goals.map((g) => (
            <TableRow key={g.id}>
              <TableCell className="font-medium">{g.thrust_area}</TableCell>
              <TableCell>
                <div className="font-medium">{g.title}</div>
                {g.description && (
                  <div className="text-xs text-muted-foreground mt-0.5">{g.description}</div>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{g.uom}</Badge>
              </TableCell>
              <TableCell>
                {g.uom === "TIMELINE" ? (
                  <InlineDate
                    value={g.target}
                    disabled={readOnly}
                    onCommit={(v) => onInlineUpdate(g.id, { target: v, target_date: v })}
                  />
                ) : (
                  <InlineText
                    value={g.target}
                    disabled={readOnly}
                    onCommit={(v) => onInlineUpdate(g.id, { target: v })}
                  />
                )}
              </TableCell>
              <TableCell>
                <InlineNumber
                  value={g.weightage}
                  min={10}
                  max={100}
                  disabled={readOnly}
                  onCommit={(v) => onInlineUpdate(g.id, { weightage: v })}
                />
              </TableCell>
              <TableCell>
                {g.is_locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex justify-end text-sm">
        <span className="text-muted-foreground mr-2">Total weightage:</span>
        <span
          className={
            "font-mono tabular-nums font-medium " +
            (total === 100 ? "text-primary" : "text-destructive")
          }
        >
          {total}%
        </span>
      </div>
    </div>
  );
}
