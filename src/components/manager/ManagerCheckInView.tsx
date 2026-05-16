import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { GoalWithCheckIn, Quarter } from "@/types";

interface Props {
  rows: GoalWithCheckIn[];
  quarter: Quarter;
  onSaveComment: (checkInId: string, comment: string) => Promise<{ error: string | null }>;
}

function scoreClass(score: number | null | undefined) {
  if (score == null) return "text-muted-foreground";
  if (score >= 100) return "text-emerald-600";
  if (score >= 75) return "text-amber-600";
  return "text-rose-600";
}

function formatActual(row: GoalWithCheckIn) {
  const { goal, checkIn } = row;
  if (!checkIn) return "—";
  if (goal.uom === "TIMELINE") return checkIn.actual_date ?? "—";
  return checkIn.actual ?? "—";
}

function formatTarget(row: GoalWithCheckIn) {
  return row.goal.uom === "TIMELINE" ? row.goal.target_date ?? "—" : row.goal.target;
}

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not Started",
  ON_TRACK: "On Track",
  COMPLETED: "Completed",
};

interface CommentCellProps {
  row: GoalWithCheckIn;
  quarter: Quarter;
  onSaveComment: Props["onSaveComment"];
}

function CommentCell({ row, onSaveComment }: CommentCellProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.checkIn?.manager_comment ?? "");
  const [saving, setSaving] = useState(false);

  if (!row.checkIn) {
    return (
      <span className="text-xs text-muted-foreground italic">
        No check-in yet
      </span>
    );
  }

  if (!editing) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setDraft(row.checkIn?.manager_comment ?? "");
          setEditing(true);
        }}
        className="h-auto py-1 px-1.5 w-full justify-start font-normal text-left whitespace-normal"
      >
        {row.checkIn.manager_comment ? (
          <span className="whitespace-pre-wrap">{row.checkIn.manager_comment}</span>
        ) : (
          <span className="text-muted-foreground italic">Click to add comment…</span>
        )}
      </Button>
    );
  }

  const hasExisting = !!row.checkIn?.manager_comment;

  const save = async () => {
    if (!row.checkIn) return;
    setSaving(true);
    const { error } = await onSaveComment(row.checkIn.id, draft.trim());
    setSaving(false);
    if (error) {
      toast({ title: "Could not save comment", description: error, variant: "destructive" });
    } else {
      toast({ title: hasExisting ? "Comment updated" : "Comment saved" });
      setEditing(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Textarea
        rows={2}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Discussion notes for this quarter…"
        autoFocus
      />
      <div className="flex justify-end gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setEditing(false)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          {saving
            ? hasExisting
              ? "Updating…"
              : "Saving…"
            : hasExisting
              ? "Update"
              : "Save"}
        </Button>
      </div>
    </div>
  );
}

export function ManagerCheckInView({ rows, quarter, onSaveComment }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No approved goals to review.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Goal Title</TableHead>
            <TableHead>Thrust Area</TableHead>
            <TableHead className="w-20">UoM</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Actual</TableHead>
            <TableHead className="w-20 text-right">Score</TableHead>
            <TableHead className="w-32">Status</TableHead>
            <TableHead className="w-[28%]">Manager Comment</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.goal.id}>
              <TableCell className="font-medium align-top">{row.goal.title}</TableCell>
              <TableCell className="align-top text-sm text-muted-foreground">
                {row.goal.thrust_area}
              </TableCell>
              <TableCell className="align-top">
                <Badge variant="secondary">{row.goal.uom}</Badge>
              </TableCell>
              <TableCell className="align-top tabular-nums">{formatTarget(row)}</TableCell>
              <TableCell className="align-top tabular-nums">{formatActual(row)}</TableCell>
              <TableCell
                className={cn(
                  "align-top text-right font-semibold tabular-nums",
                  scoreClass(row.checkIn?.score ?? null),
                )}
              >
                {row.checkIn?.score == null ? "—" : `${Number(row.checkIn.score).toFixed(1)}%`}
              </TableCell>
              <TableCell className="align-top text-sm">
                {row.checkIn ? STATUS_LABEL[row.checkIn.status] : "—"}
              </TableCell>
              <TableCell className="align-top">
                <CommentCell row={row} quarter={quarter} onSaveComment={onSaveComment} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
