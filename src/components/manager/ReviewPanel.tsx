import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Lock, Loader2, Check } from "lucide-react";
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
  const [draft, setDraft] = useState(String(value));
  const [status, setStatus] = useState<Status>("idle");

  const commit = async () => {
    const n = Number(draft);
    if (!Number.isFinite(n) || n === value) {
      setDraft(String(value));
      return;
    }
    if (min !== undefined && n < min) {
      setDraft(String(value));
      return;
    }
    if (max !== undefined && n > max) {
      setDraft(String(value));
      return;
    }
    setStatus("saving");
    const { error } = await onCommit(n);
    if (error) {
      setStatus("error");
      setDraft(String(value));
    } else {
      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1200);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        step={1}
        inputMode="numeric"
        disabled={disabled || status === "saving"}
        value={draft}
        aria-label="Weightage"
        title={disabled ? "Read-only" : "Click to edit, blur to save"}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        className="h-7 w-20"
      />
      {status === "saving" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      {status === "saved" && <Check className="h-3 w-3 text-green-600" />}
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
        className="h-7"
      />
      {status === "saving" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      {status === "saved" && <Check className="h-3 w-3 text-green-600" />}
    </div>
  );
}

export function ReviewPanel({ goals, readOnly, onInlineUpdate }: Props) {
  const total = goals.reduce((s, g) => s + g.weightage, 0);

  return (
    <div className="space-y-3">
      {!readOnly && (
        <p className="text-xs text-muted-foreground">
          Click any <span className="font-medium text-foreground">Target</span> or{" "}
          <span className="font-medium text-foreground">Weightage</span> cell to edit it. Changes
          save automatically when you click away.
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[16%]">Thrust area</TableHead>
            <TableHead>Goal</TableHead>
            <TableHead className="w-[10%]">UoM</TableHead>
            <TableHead className="w-[18%]">Target</TableHead>
            <TableHead className="w-[14%]">Weightage</TableHead>
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
                <InlineText
                  value={g.target}
                  disabled={readOnly}
                  onCommit={(v) => onInlineUpdate(g.id, { target: v })}
                />
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
            (total === 100 ? "text-green-700" : "text-destructive")
          }
        >
          {total}%
        </span>
      </div>
    </div>
  );
}
