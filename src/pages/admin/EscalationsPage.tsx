import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useEscalationsStore } from "@/stores/escalationsStore";
import type {
  EscalateTarget,
  EscalationRule,
  EscalationRuleDraft,
  TriggerType,
} from "@/types";

const TRIGGER_LABELS: Record<TriggerType, string> = {
  SUBMIT_OVERDUE: "Submission overdue",
  APPROVE_OVERDUE: "Approval overdue",
  CHECKIN_OVERDUE: "Check-in overdue",
};

const TARGET_LABELS: Record<EscalateTarget, string> = {
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  SKIP_LEVEL: "Skip-level",
  HR: "HR / Admin",
};

const TARGET_BADGE: Record<EscalateTarget, string> = {
  EMPLOYEE: "bg-sky-600 hover:bg-sky-600",
  MANAGER: "bg-amber-500 text-white hover:bg-amber-500",
  SKIP_LEVEL: "bg-violet-600 hover:bg-violet-600",
  HR: "bg-rose-600 hover:bg-rose-600",
};

const DEFAULT_DRAFT: EscalationRuleDraft = {
  name: "",
  trigger_type: "SUBMIT_OVERDUE",
  threshold_days: 7,
  escalate_to: "EMPLOYEE",
  is_active: true,
};

export default function EscalationsPage() {
  const { toast } = useToast();
  const {
    rules,
    log,
    loading,
    running,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    fetchLog,
    runNow,
    resolve,
  } = useEscalationsStore();

  const [tab, setTab] = useState<"rules" | "log">("rules");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EscalationRule | null>(null);
  const [draft, setDraft] = useState<EscalationRuleDraft>(DEFAULT_DRAFT);
  const [confirmDelete, setConfirmDelete] = useState<EscalationRule | null>(null);

  useEffect(() => {
    void fetchRules();
    void fetchLog();
  }, [fetchRules, fetchLog]);

  const openCreate = () => {
    setEditingRule(null);
    setDraft(DEFAULT_DRAFT);
    setDialogOpen(true);
  };

  const openEdit = (rule: EscalationRule) => {
    setEditingRule(rule);
    setDraft({
      name: rule.name,
      trigger_type: rule.trigger_type,
      threshold_days: rule.threshold_days,
      escalate_to: rule.escalate_to,
      is_active: rule.is_active,
    });
    setDialogOpen(true);
  };

  const onSaveRule = async () => {
    if (!draft.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (draft.threshold_days < 1) {
      toast({ title: "Threshold must be at least 1 day", variant: "destructive" });
      return;
    }
    const op = editingRule
      ? updateRule(editingRule.id, draft)
      : createRule(draft);
    const { error } = await op;
    if (error) {
      toast({ title: "Save failed", description: error, variant: "destructive" });
      return;
    }
    setDialogOpen(false);
    toast({ title: editingRule ? "Rule updated" : "Rule created" });
  };

  const onDeleteRule = async () => {
    if (!confirmDelete) return;
    const { error } = await deleteRule(confirmDelete.id);
    if (error) {
      toast({ title: "Delete failed", description: error, variant: "destructive" });
      return;
    }
    setConfirmDelete(null);
    toast({ title: "Rule deleted" });
  };

  const onRunNow = async () => {
    const res = await runNow();
    if (!res.ok) {
      toast({
        title: "Run failed",
        description: res.error ?? "Unknown error",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Escalations evaluated",
      description: `${res.fired} fired · ${res.skipped_duplicates} skipped (already fired today) · ${res.evaluated_rules} rules checked.`,
    });
    setTab("log");
  };

  const onResolve = async (id: string) => {
    const { error } = await resolve(id);
    if (error) {
      toast({ title: "Resolve failed", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Marked resolved" });
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            Escalations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure time-based escalation rules and review the log of fired
            notifications.
          </p>
        </div>
        <Button onClick={onRunNow} disabled={running}>
          {running ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          {running ? "Running…" : "Run escalations now"}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "rules" | "log")}>
        <TabsList>
          <TabsTrigger value="rules">Rules ({rules.length})</TabsTrigger>
          <TabsTrigger value="log">Log ({log.length})</TabsTrigger>
        </TabsList>

        {/* ============ Tab 1 — Rules ========================================= */}
        <TabsContent value="rules" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Escalation rules</CardTitle>
                <CardDescription>
                  Each rule fires when its condition has been true for the
                  threshold period. Build a chain by creating multiple rules for
                  the same trigger with increasing thresholds + escalating targets.
                </CardDescription>
              </div>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-1" />
                Add rule
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="w-44">Trigger</TableHead>
                      <TableHead className="w-28 text-right">Threshold</TableHead>
                      <TableHead className="w-32">Escalate to</TableHead>
                      <TableHead className="w-20 text-center">Active</TableHead>
                      <TableHead className="w-28 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && rules.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-sm text-muted-foreground py-6"
                        >
                          Loading…
                        </TableCell>
                      </TableRow>
                    ) : rules.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-sm text-muted-foreground py-6"
                        >
                          No rules defined yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rules.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-sm">
                            <Badge variant="secondary">
                              {TRIGGER_LABELS[r.trigger_type]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm tabular-nums text-right">
                            {r.threshold_days} days
                          </TableCell>
                          <TableCell>
                            <Badge className={TARGET_BADGE[r.escalate_to]}>
                              {TARGET_LABELS[r.escalate_to]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Switch
                              checked={r.is_active}
                              onCheckedChange={(v) =>
                                void updateRule(r.id, { is_active: v })
                              }
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEdit(r)}
                              aria-label="Edit rule"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setConfirmDelete(r)}
                              aria-label="Delete rule"
                            >
                              <Trash2 className="h-4 w-4 text-rose-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============ Tab 2 — Log =========================================== */}
        <TabsContent value="log" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Escalation log</CardTitle>
              <CardDescription>
                Every fired escalation, newest first. Click "Resolve" once the
                issue has been addressed to suppress further visual noise.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-44">Fired</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="w-44">Trigger</TableHead>
                      <TableHead>Recipient</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="w-28 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading && log.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-sm text-muted-foreground py-6"
                        >
                          Loading…
                        </TableCell>
                      </TableRow>
                    ) : log.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-sm text-muted-foreground py-6"
                        >
                          No escalations fired yet. Click "Run escalations now"
                          to evaluate the active rules against current data.
                        </TableCell>
                      </TableRow>
                    ) : (
                      log.map((e) => (
                        <TableRow
                          key={e.id}
                          className={e.resolved_at ? "opacity-60" : ""}
                        >
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(e.fired_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium">
                              {e.subject?.full_name ?? "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {e.subject?.email ?? ""}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {TRIGGER_LABELS[e.trigger_type]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {e.recipient?.full_name ?? (
                              <span className="text-muted-foreground italic">
                                no recipient
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm max-w-md">
                            {e.reason_text}
                          </TableCell>
                          <TableCell className="text-right">
                            {e.resolved_at ? (
                              <Badge variant="outline" className="text-emerald-600">
                                Resolved
                              </Badge>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onResolve(e.id)}
                              >
                                Resolve
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============ Rule editor dialog ====================================== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Edit rule" : "Create escalation rule"}
            </DialogTitle>
            <DialogDescription>
              Rules are evaluated daily at 09:00 UTC and on demand via the
              "Run escalations now" button.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="rule_name">Name</Label>
              <Input
                id="rule_name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Goal-setting overdue L1"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="rule_trigger">Trigger</Label>
              <Select
                value={draft.trigger_type}
                onValueChange={(v) =>
                  setDraft({ ...draft, trigger_type: v as TriggerType })
                }
              >
                <SelectTrigger id="rule_trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TRIGGER_LABELS) as TriggerType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TRIGGER_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="rule_threshold">Threshold (days)</Label>
              <Input
                id="rule_threshold"
                type="number"
                min={1}
                value={draft.threshold_days}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    threshold_days: Number(e.target.value) || 1,
                  })
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="rule_target">Escalate to</Label>
              <Select
                value={draft.escalate_to}
                onValueChange={(v) =>
                  setDraft({ ...draft, escalate_to: v as EscalateTarget })
                }
              >
                <SelectTrigger id="rule_target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TARGET_LABELS) as EscalateTarget[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TARGET_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between pt-1">
              <Label htmlFor="rule_active" className="cursor-pointer">
                Active
              </Label>
              <Switch
                id="rule_active"
                checked={draft.is_active}
                onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={onSaveRule}>
              {editingRule ? "Save changes" : "Create rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ Delete confirm dialog =================================== */}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete escalation rule?</DialogTitle>
            <DialogDescription>
              This will permanently remove "{confirmDelete?.name}". Existing log
              entries from past fires of this rule will be preserved but their
              link to the rule will be cleared.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDeleteRule}>
              Delete rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
