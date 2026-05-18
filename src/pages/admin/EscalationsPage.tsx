import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarIcon,
  Loader2,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { BlurFade } from "@/components/ui/magicui/blur-fade";
import { AnalyticsEmptyState } from "@/components/admin/AnalyticsEmptyState";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
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
  // SKIP_LEVEL is kept in the enum for back-compat with seeded/legacy rules
  // but hidden from the create/edit dropdown. The Admin label maps to the HR
  // enum value — the evaluator's resolveRecipient() already routes HR to the
  // first ADMIN profile, so no migration is needed.
  SKIP_LEVEL: "Skip-level",
  HR: "Admin",
};

const TARGET_BADGE: Record<EscalateTarget, string> = {
  EMPLOYEE: "bg-sky-600 hover:bg-sky-600",
  MANAGER: "bg-amber-500 text-white hover:bg-amber-500",
  SKIP_LEVEL: "bg-violet-600 hover:bg-violet-600",
  HR: "bg-rose-600 hover:bg-rose-600",
};

// Dropdown shows just these three; if an existing rule still has SKIP_LEVEL it
// is prepended at edit time so the Select keeps a valid current value.
const VISIBLE_TARGETS: EscalateTarget[] = ["EMPLOYEE", "MANAGER", "HR"];

const DEFAULT_DRAFT: EscalationRuleDraft = {
  name: "",
  trigger_type: "SUBMIT_OVERDUE",
  threshold_days: 7,
  escalate_to: "EMPLOYEE",
  is_active: true,
};

// Cycle opens 1st May per BRD §2.3. Anchor for the "fires on <date>" preview
// in the rule editor only — the evaluator anchors each rule off the sheet's
// own created_at/submitted_at/approved_at.
function cycleOpenAnchor(): Date {
  const now = new Date();
  const year = now.getMonth() < 4 ? now.getFullYear() - 1 : now.getFullYear();
  const d = new Date(year, 4, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateFromThreshold(days: number): Date {
  const d = new Date(cycleOpenAnchor());
  d.setDate(d.getDate() + days);
  return d;
}

function thresholdFromDate(date: Date): number {
  const anchor = cycleOpenAnchor();
  const diffMs = date.getTime() - anchor.getTime();
  return Math.max(1, Math.round(diffMs / 86400000));
}

type ResultState = {
  status: "success" | "error";
  title: string;
  message: string;
} | null;

export default function EscalationsPage() {
  const {
    rules,
    log,
    loading,
    running,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    clearAllRules,
    fetchLog,
    runNow,
    resolve,
  } = useEscalationsStore();

  const [tab, setTab] = useState<"rules" | "log">("rules");

  // Rule editor (create/edit)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<EscalationRule | null>(null);
  const [draft, setDraft] = useState<EscalationRuleDraft>(DEFAULT_DRAFT);
  const [saving, setSaving] = useState(false);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  // Always show VISIBLE_TARGETS; if the rule being edited still has a hidden
  // value (SKIP_LEVEL) keep it in the option list so the Select stays valid.
  const targetOptions = useMemo<EscalateTarget[]>(() => {
    if (VISIBLE_TARGETS.includes(draft.escalate_to)) return VISIBLE_TARGETS;
    return [draft.escalate_to, ...VISIBLE_TARGETS];
  }, [draft.escalate_to]);

  // Destructive flows
  const [deletingRule, setDeletingRule] = useState<EscalationRule | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Outcome dialog (success.lottie / error.lottie). Replaces useToast on this
  // page per the round-7 design-system rule.
  const [result, setResult] = useState<ResultState>(null);

  useEffect(() => {
    void fetchRules();
    void fetchLog();
  }, [fetchRules, fetchLog]);

  useFocusRefresh(() => {
    void Promise.all([fetchRules(), fetchLog()]);
  });

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

  // Validate locally then hit Supabase directly — admin's confirm is the
  // submit click itself; outcome dialog (success/error Lottie) is the only
  // feedback channel.
  const onSubmitRule = async () => {
    if (!draft.name.trim()) {
      setResult({
        status: "error",
        title: "Name is required",
        message: "Give the rule a descriptive name before saving.",
      });
      return;
    }
    if (draft.threshold_days < 1) {
      setResult({
        status: "error",
        title: "Threshold too small",
        message: "Threshold must be at least 1 day.",
      });
      return;
    }
    setSaving(true);
    const op = editingRule
      ? updateRule(editingRule.id, draft)
      : createRule(draft);
    const { error } = await op;
    setSaving(false);
    if (error) {
      setResult({
        status: "error",
        title: editingRule ? "Could not update rule" : "Could not create rule",
        message: error,
      });
      return;
    }
    setDialogOpen(false);
    setResult({
      status: "success",
      title: editingRule ? "Rule updated" : "Rule created",
      message: `"${draft.name.trim()}" is ${
        editingRule ? "saved" : "live"
      } and will be evaluated on the next run.`,
    });
  };

  const executeDelete = async () => {
    if (!deletingRule) return;
    const name = deletingRule.name;
    setDeleting(true);
    const { error } = await deleteRule(deletingRule.id);
    setDeleting(false);
    setDeletingRule(null);
    if (error) {
      setResult({
        status: "error",
        title: "Could not delete rule",
        message: error,
      });
      return;
    }
    setResult({
      status: "success",
      title: "Rule deleted",
      message: `"${name}" has been removed. Past log entries are preserved.`,
    });
  };

  const executeClearAll = async () => {
    setClearing(true);
    const { error, cleared } = await clearAllRules();
    setClearing(false);
    setClearAllOpen(false);
    if (error) {
      setResult({
        status: "error",
        title: "Could not clear rules",
        message: error,
      });
      return;
    }
    setResult({
      status: "success",
      title: "All rules cleared",
      message: `${cleared} rule${
        cleared === 1 ? "" : "s"
      } removed. No new escalations will fire until at least one rule is created.`,
    });
  };

  const onRunNow = async () => {
    const res = await runNow();
    if (!res.ok) {
      setResult({
        status: "error",
        title: "Run failed",
        message: res.error ?? "Unknown error during evaluation.",
      });
      return;
    }
    setResult({
      status: "success",
      title: "Escalations evaluated",
      message: `${res.fired} fired · ${res.skipped_duplicates} skipped (already fired today) · ${res.evaluated_rules} rules checked.`,
    });
    setTab("log");
  };

  const onResolve = async (id: string) => {
    const { error } = await resolve(id);
    if (error) {
      setResult({
        status: "error",
        title: "Could not resolve",
        message: error,
      });
    }
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight leading-tight">
            Escalations
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Configure time-based escalation rules and review the log of fired
            notifications.
          </p>
        </div>
        <Button
          onClick={onRunNow}
          disabled={running}
          className="rounded-sm shrink-0"
        >
          {running ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-1" />
          )}
          {running ? "Running…" : "Run escalations now"}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "rules" | "log")}>
        <TabsList className="rounded-sm">
          <TabsTrigger value="rules" className="rounded-sm">
            Rules ({rules.length})
          </TabsTrigger>
          <TabsTrigger value="log" className="rounded-sm">
            Log ({log.length})
          </TabsTrigger>
        </TabsList>

        {/* ============ Tab 1 — Rules ========================================= */}
        <TabsContent value="rules" className="space-y-3">
          <BlurFade>
            <Card className="rounded-md border-border/60 bg-card">
              <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Escalation rules</CardTitle>
                  <CardDescription>
                    Each rule fires when its condition has been true for the
                    threshold period. Build a chain by creating multiple rules
                    for the same trigger with increasing thresholds + escalating
                    targets.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setClearAllOpen(true)}
                    disabled={rules.length === 0 || clearing}
                    className="rounded-sm text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear all
                  </Button>
                  <Button size="sm" onClick={openCreate} className="rounded-sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add rule
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading && rules.length === 0 ? (
                  <div className="rounded-md border border-border/60 bg-card overflow-hidden">
                    <p className="text-center text-sm text-muted-foreground py-6">
                      Loading…
                    </p>
                  </div>
                ) : rules.length === 0 ? (
                  <AnalyticsEmptyState
                    icon={AlertTriangle}
                    title="No escalation rules yet"
                    description="Create your first rule to start chasing overdue submissions, approvals, or check-ins. Rules are evaluated daily at 09:00 UTC."
                    onRefresh={() => void fetchRules()}
                    refreshing={loading}
                  />
                ) : (
                  <div className="rounded-md border border-border/60 bg-card overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead className="w-44">Trigger</TableHead>
                          <TableHead className="w-28 text-right">
                            Threshold
                          </TableHead>
                          <TableHead className="w-32">Escalate to</TableHead>
                          <TableHead className="w-20 text-center">
                            Active
                          </TableHead>
                          <TableHead className="w-28 text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rules.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">
                              {r.name}
                            </TableCell>
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
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => openEdit(r)}
                                  aria-label="Edit rule"
                                  className="rounded-sm"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => setDeletingRule(r)}
                                  aria-label="Delete rule"
                                  className="rounded-sm text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </BlurFade>
        </TabsContent>

        {/* ============ Tab 2 — Log =========================================== */}
        <TabsContent value="log" className="space-y-3">
          <BlurFade>
            <Card className="rounded-md border-border/60 bg-card">
              <CardHeader>
                <CardTitle className="text-base">Escalation log</CardTitle>
                <CardDescription>
                  Every fired escalation, newest first. Click "Resolve" once the
                  issue has been addressed to suppress further visual noise.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border border-border/60 bg-card overflow-hidden">
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
                            No escalations fired yet. Click "Run escalations
                            now" to evaluate the active rules against current
                            data.
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
                                <Badge
                                  variant="outline"
                                  className="text-emerald-600"
                                >
                                  Resolved
                                </Badge>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onResolve(e.id)}
                                  className="rounded-sm"
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
          </BlurFade>
        </TabsContent>
      </Tabs>

      {/* ============ Rule editor dialog ====================================== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-md border border-border/60 bg-card shadow-2xl shadow-black/40 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight leading-tight">
              {editingRule ? "Edit rule" : "Create escalation rule"}
            </DialogTitle>
            <DialogDescription>
              Rules are evaluated daily at 09:00 UTC and on demand via the "Run
              escalations now" button.
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
              <Label htmlFor="rule_threshold">Fires on</Label>
              <Popover
                open={datePopoverOpen}
                onOpenChange={setDatePopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    id="rule_threshold"
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-left font-normal h-9 rounded-sm"
                  >
                    <CalendarIcon className="h-3.5 w-3.5 mr-2 opacity-70" />
                    {format(dateFromThreshold(draft.threshold_days), "PPP")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="p-0">
                  <Calendar
                    mode="single"
                    selected={dateFromThreshold(draft.threshold_days)}
                    onSelect={(d) => {
                      if (!d) return;
                      setDraft({
                        ...draft,
                        threshold_days: thresholdFromDate(d),
                      });
                      setDatePopoverOpen(false);
                    }}
                    disabled={(date) => date <= cycleOpenAnchor()}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                {draft.threshold_days} day
                {draft.threshold_days === 1 ? "" : "s"} from cycle open (
                {format(cycleOpenAnchor(), "PPP")}).
              </p>
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
                  {targetOptions.map((t) => (
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

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
              className="rounded-sm"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void onSubmitRule()}
              disabled={saving}
              className="rounded-sm"
            >
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editingRule ? "Save changes" : "Create rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ Delete confirm dialog =================================== */}
      <Dialog
        open={!!deletingRule}
        onOpenChange={(o) => {
          if (!deleting && !o) setDeletingRule(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden rounded-md border border-border/60 bg-card p-5 text-foreground shadow-2xl shadow-black/40 sm:max-w-md"
        >
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Delete this rule?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This permanently removes{" "}
              <strong>{deletingRule?.name}</strong>. Past log entries are
              preserved but lose their link to the rule. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2 sm:gap-2 sm:justify-center">
            <Button
              variant="ghost"
              className="rounded-sm"
              disabled={deleting}
              onClick={() => setDeletingRule(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-sm"
              disabled={deleting}
              onClick={() => void executeDelete()}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {deleting ? "Deleting…" : "Yes, delete rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ Clear-all confirm dialog ================================ */}
      <Dialog
        open={clearAllOpen}
        onOpenChange={(o) => {
          if (!clearing) setClearAllOpen(o);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden rounded-md border border-border/60 bg-card p-5 text-foreground shadow-2xl shadow-black/40 sm:max-w-md"
        >
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Clear all rules?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Removes every escalation rule in one shot. Past log entries are
              preserved (with rule names cleared) but no new escalations will
              fire until at least one rule is created. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-3 max-h-[40vh] overflow-y-auto scrollbar-hide pr-1">
            <div className="rounded-md border border-border/60 bg-card p-3">
              <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                Will remove
              </div>
              <div className="text-sm font-semibold leading-tight mt-1 tabular-nums">
                {rules.length} rule{rules.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-2 sm:justify-center">
            <Button
              variant="ghost"
              className="rounded-sm"
              disabled={clearing}
              onClick={() => setClearAllOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-sm"
              disabled={clearing}
              onClick={() => void executeClearAll()}
            >
              {clearing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {clearing ? "Clearing…" : "Yes, clear everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ Outcome dialog ========================================== */}
      <Dialog
        open={!!result}
        onOpenChange={(o) => {
          if (!o) setResult(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden rounded-md border border-border/60 bg-card p-5 text-foreground shadow-2xl shadow-black/40 sm:max-w-md"
        >
          <DialogHeader className="items-center text-center">
            <div className="mx-auto h-28 w-28">
              {result && (
                <DotLottieReact
                  key={result.status}
                  src={
                    result.status === "success"
                      ? "/success.lottie"
                      : "/error.lottie"
                  }
                  autoplay
                  loop={false}
                />
              )}
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {result?.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {result?.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2 sm:gap-2 sm:justify-center">
            <Button
              className="rounded-sm"
              variant={result?.status === "success" ? "default" : "outline"}
              onClick={() => setResult(null)}
            >
              {result?.status === "success" ? "OK" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
