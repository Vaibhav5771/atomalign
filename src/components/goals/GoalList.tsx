import { useState } from "react";
import { Pencil, Trash2, Lock, Share2, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleEditSubmit = async (draft: GoalDraft) => {
    if (!editing || !onUpdate) return;
    const { error } = await onUpdate(editing.id, draft);
    if (!error) setEditing(null);
  };

  const handleDeleteClick = async (id: string) => {
    if (!onDelete) return;
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  const rowCount = goals.length + sharedAssignments.length;

  if (rowCount === 0) {
    return (
      <div className="border border-dashed border-border rounded-none p-6 text-center text-sm text-muted-foreground">
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
                    <Input
                      key={g.weightage}
                      type="number"
                      step={1}
                      inputMode="numeric"
                      defaultValue={g.weightage}
                      className="h-7 w-20"
                      onBlur={async (e) => {
                        const v = Number(e.target.value);
                        if (v < 10 || v > 100 || v === g.weightage) {
                          e.target.value = String(g.weightage);
                          return;
                        }
                        const { error } = await onUpdate!(g.id, { weightage: v });
                        if (error) e.target.value = String(g.weightage);
                      }}
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
                        onClick={() => setEditing(g)}
                        disabled={deletingId === g.id}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canEditFully && onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleDeleteClick(g.id)}
                        disabled={deletingId === g.id}
                      >
                        {deletingId === g.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
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
                  <Input
                    key={link.weightage}
                    type="number"
                    step={1}
                    inputMode="numeric"
                    defaultValue={link.weightage}
                    className="h-7 w-20"
                    onBlur={async (e) => {
                      const v = Number(e.target.value);
                      if (v < 10 || v > 100 || v === link.weightage) {
                        e.target.value = String(link.weightage);
                        return;
                      }
                      const { error } = await onUpdateSharedWeightage(link.id, v);
                      if (error) e.target.value = String(link.weightage);
                    }}
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

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit goal</DialogTitle>
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
    </>
  );
}
