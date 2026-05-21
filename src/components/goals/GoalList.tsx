import { useState } from "react";
import { Check, Pencil, Trash2, Lock, Share2, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { NumberTicker } from "@/components/ui/magicui/number-ticker";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GoalForm } from "@/components/goals/GoalForm";
import type { Goal, GoalDraft, SharedByProfile } from "@/types";
import type { SharedAssignment } from "@/stores/goalSheetStore";

interface Props {
  goals: Goal[];
  sharedAssignments?: SharedAssignment[];
  sharerProfiles?: Record<string, SharedByProfile>;
  editable: boolean;
  onUpdate?: (id: string, patch: Partial<Goal>) => Promise<{ error: string | null }>;
  onDelete?: (id: string) => Promise<{ error: string | null }>;
  onUpdateSharedWeightage?: (linkId: string, weightage: number) => Promise<{ error: string | null }>;
}

function sharerLabel(profile: SharedByProfile | undefined) {
  if (!profile) return "Shared";
  const name = profile.full_name || profile.email;
  const roleLabel = profile.role === "ADMIN" ? "Admin" : profile.role === "MANAGER" ? "Manager" : "";
  return roleLabel ? `Shared by ${name} (${roleLabel})` : `Shared by ${name}`;
}

function InlineWeightageSlider({
  value,
  onCommit,
}: {
  value: number;
  onCommit: (v: number) => Promise<{ error: string | null }>;
}) {
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const commit = async (n: number) => {
    if (n === value || n < 10 || n > 100) return;
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
        min={10}
        max={100}
        step={10}
        disabled={status === "saving"}
        onValueChange={(v) => setDraft(v[0] ?? draft)}
        onValueCommit={(v) => void commit(v[0] ?? draft)}
        className="flex-1"
      />
      <span className={cn("text-sm font-semibold tabular-nums w-10 text-right shrink-0 text-primary")}>
        <NumberTicker value={draft} suffix="%" />
      </span>
      {status === "saving" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      {status === "saved" && <Check className="h-3 w-3 text-primary" />}
    </div>
  );
}

export function GoalList({
  goals,
  sharedAssignments = [],
  sharerProfiles = {},
  editable,
  onUpdate,
  onDelete,
  onUpdateSharedWeightage,
}: Props) {
  const [editing, setEditing] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const handleEditSubmit = async (draft: GoalDraft) => {
    if (!editing || !onUpdate) return;
    const { error } = await onUpdate(editing.id, draft);
    // Close on success; on error keep the dialog open so the user keeps their
    // edits while the parent's outcome dialog surfaces the failure on top.
    if (!error) setEditing(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleting || !onDelete) return;
    setDeletePending(true);
    const target = deleting;
    await onDelete(target.id);
    setDeletePending(false);
    setDeleting(null);
  };

  const rowCount = goals.length + sharedAssignments.length;

  if (rowCount === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-card p-6 text-center text-sm text-muted-foreground">
        No goals yet. Add your first goal above.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[18%]">Thrust area</TableHead>
            <TableHead>Goal</TableHead>
            <TableHead className="w-[10%]">UoM</TableHead>
            <TableHead className="w-[12%]">Target</TableHead>
            <TableHead className="w-[12%]">Weightage</TableHead>
            <TableHead className="w-[110px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {goals.map((g) => {
            const isShared = g.is_shared;
            const sharer = g.shared_by ? sharerProfiles[g.shared_by] : undefined;
            const canEditFully = editable && !g.is_locked && !isShared;
            const canEditWeightageOnly = editable && !g.is_locked && isShared && onUpdate;
            return (
              <TableRow key={g.id} className={isShared ? "bg-muted/40" : undefined}>
                <TableCell className="font-medium">{g.thrust_area}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {isShared && <Share2 className="h-3.5 w-3.5 text-indigo-600" />}
                    <div className="font-medium">{g.title}</div>
                  </div>
                  {g.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {g.description}
                    </div>
                  )}
                  {isShared && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {sharerLabel(sharer)} — title & target are read-only
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{g.uom}</Badge>
                </TableCell>
                <TableCell className="font-mono tabular-nums text-xs">{g.target}</TableCell>
                <TableCell className="font-mono tabular-nums">
                  {canEditWeightageOnly ? (
                    <InlineWeightageSlider
                      value={g.weightage}
                      onCommit={(v) => onUpdate!(g.id, { weightage: v })}
                    />
                  ) : (
                    `${g.weightage}%`
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {g.is_locked && <Lock className="h-3.5 w-3.5 text-muted-foreground self-center" />}
                    {isShared && !g.is_locked && (
                      <span className="text-xs text-muted-foreground self-center">Shared</span>
                    )}
                    {canEditFully && onUpdate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-sm"
                        onClick={() => setEditing(g)}
                        disabled={deleting?.id === g.id}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canEditFully && onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-sm"
                        onClick={() => setDeleting(g)}
                        disabled={deleting?.id === g.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}

          {sharedAssignments.map(({ link, source }) => (
            <TableRow key={link.id} className="bg-muted/40">
              <TableCell className="font-medium">{source.thrust_area}</TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Share2 className="h-3.5 w-3.5 text-indigo-600" />
                  <div className="font-medium">{source.title}</div>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Shared by admin — title & target are read-only
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{source.uom}</Badge>
              </TableCell>
              <TableCell className="font-mono tabular-nums text-xs">{source.target}</TableCell>
              <TableCell className="font-mono tabular-nums">
                {editable && onUpdateSharedWeightage ? (
                  <InlineWeightageSlider
                    value={link.weightage}
                    onCommit={(v) => onUpdateSharedWeightage(link.id, v)}
                  />
                ) : (
                  `${link.weightage}%`
                )}
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">Shared</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* -------------------- Edit goal dialog ----------------------------- */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl overflow-hidden rounded-md border border-border/60 bg-card p-5 text-foreground shadow-2xl shadow-black/40">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight leading-tight">
              Edit goal
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Save changes when you're done. Weightage adjusts your sheet total.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <GoalForm
              initial={editing}
              onSubmit={handleEditSubmit}
              onCancel={() => setEditing(null)}
              submitLabel="Save changes"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* -------------------- Delete goal confirm dialog ------------------- */}
      <Dialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o && !deletePending) setDeleting(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden rounded-md border border-border/60 bg-card p-5 text-foreground shadow-2xl shadow-black/40 sm:max-w-md"
        >
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="text-xl font-semibold tracking-tight leading-tight">
              Delete this goal?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              The goal will be removed from your sheet and its weightage freed
              up. Past audit-log entries are preserved.
            </DialogDescription>
          </DialogHeader>

          {deleting && (
            <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
              <div className="text-[0.6rem] uppercase tracking-wider text-destructive">
                Will remove
              </div>
              <div className="mt-0.5 font-medium text-foreground">
                {deleting.title}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {deleting.thrust_area} · {deleting.uom} · {deleting.weightage}%
              </div>
            </div>
          )}

          <DialogFooter className="mt-2 gap-2 sm:gap-2 sm:justify-center">
            <Button
              variant="ghost"
              className="rounded-sm"
              onClick={() => setDeleting(null)}
              disabled={deletePending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-sm"
              onClick={handleConfirmDelete}
              disabled={deletePending}
            >
              {deletePending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {deletePending ? "Deleting…" : "Yes, delete goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
