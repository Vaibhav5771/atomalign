import { useEffect, useMemo, useState } from "react";
import { Loader2, CalendarIcon, Lock, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/authStore";
import { currentCycleYear } from "@/stores/goalSheetStore";
import { BlurFade } from "@/components/ui/magicui/blur-fade";
import { NumberTicker } from "@/components/ui/magicui/number-ticker";
import { AnimatedCircularProgress } from "@/components/ui/magicui/animated-circular-progress";
import { NumericStepper } from "@/components/shared/NumericStepper";
import {
  TeamTree,
  type SummaryEmployeeNode,
  type SummaryManagerNode,
} from "@/components/admin/TeamTree";
import { cn } from "@/lib/utils";
import type { Profile, SheetStatus, UoMType } from "@/types";

interface FormState {
  thrust_area: string;
  title: string;
  description: string;
  uom: UoMType;
  target: string;
  target_date: string;
  weightage: number;
}

const EMPTY: FormState = {
  thrust_area: "",
  title: "",
  description: "",
  uom: "NUMERIC",
  target: "",
  target_date: "",
  weightage: 10,
};

const UOM_META: Record<UoMType, { label: string; hint: string }> = {
  NUMERIC: {
    label: "Numeric — revenue, count, units",
    hint: "Enter a number, e.g. 50000000 for ₹5 Cr or 200 for units sold.",
  },
  PERCENT: {
    label: "Percent — completion %, NPS",
    hint: "Enter a value 0–100. No % sign needed.",
  },
  TIMELINE: {
    label: "Timeline — deadline-based",
    hint: "Pick the target date. Score is binary on the deadline.",
  },
  ZERO: {
    label: "Zero-based — zero incidents = success",
    hint: "Target is locked at 0. Scores 100% only when actual = 0.",
  },
};

// Red-glow indicator for invalid inputs and section wrappers. Mirrors the soft
// primary focus style but uses the destructive token, so an empty field reads
// as "missing" rather than "broken".
const errorGlowClass =
  "border-destructive/55 ring-1 ring-destructive/20 shadow-[0_0_18px_-8px_color-mix(in_oklch,var(--destructive)_55%,transparent)]";
const errorGlowWrapperClass =
  "ring-1 ring-destructive/30 shadow-[0_0_18px_-8px_color-mix(in_oklch,var(--destructive)_55%,transparent)]";

function formatLargeNumber(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "0";
  if (Math.abs(n) >= 1_00_00_000) return `≈ ${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1_00_000) return `≈ ${(n / 1_00_000).toFixed(2)} L`;
  if (Math.abs(n) >= 1_000) return `≈ ${(n / 1_000).toFixed(1)} K`;
  return "";
}

type PrecheckRow = {
  employeeId: string;
  name: string;
  sheetId: string | null;
  status: SheetStatus | null;
  currentTotal: number;
  available: number;
  conflict: boolean;
  reason: string;
};

// A "past shared goal" is a deduped signature across all individual goal rows
// that were pushed together. Same (title, thrust, uom, target, weightage,
// shared_by) batched at the same minute = one logical push.
interface PastSharedGoal {
  key: string;
  title: string;
  thrust_area: string;
  description: string | null;
  uom: UoMType;
  target: string;
  target_date: string | null;
  weightage: number;
  created_at: string;
  recipientCount: number;
  recipientNames: string[];
  // Every underlying goals.id that belongs to this shared-goal group.
  // Used by the delete flow to wipe all N recipient rows in one statement.
  goal_ids: string[];
}

export default function SharedGoalsPage() {
  const { toast } = useToast();
  const currentUser = useAuthStore((s) => s.user);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [precheck, setPrecheck] = useState<PrecheckRow[]>([]);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [pastGoals, setPastGoals] = useState<PastSharedGoal[]>([]);
  const [pastLoading, setPastLoading] = useState(false);
  // Delete-a-pushed-shared-goal flow. Admin-only — gated by the
  // `goals_delete_admin` RLS policy added in migration 0003.
  const [deletingPast, setDeletingPast] = useState<PastSharedGoal | null>(null);
  const [deletingPastBusy, setDeletingPastBusy] = useState(false);
  // Outcome dialog shown after the push completes. status drives icon, copy,
  // and CTA label (OK on success, Close on error).
  const [result, setResult] = useState<{
    status: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  // Per-field validation surfaces. Empty string = valid, anything truthy
  // becomes a red-glow indicator on that input until the user edits it.
  type FieldErrors = {
    thrust_area?: string;
    title?: string;
    target?: string;
    target_date?: string;
    recipients?: string;
  };
  const [errors, setErrors] = useState<FieldErrors>({});
  const clearError = (key: keyof FieldErrors) =>
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });

  // Load past shared goals on-demand the first time the dialog opens.
  // Groups raw `goals` rows by their content signature so a single push to N
  // recipients shows up as one card with `recipientCount === N`.
  useEffect(() => {
    if (!pastOpen) return;
    if (!currentUser?.id) return;
    let cancelled = false;
    setPastLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("goals")
          .select(
            "id, thrust_area, title, description, uom, target, target_date, weightage, created_at, sheet:goal_sheets(employee:profiles!goal_sheets_employee_id_fkey(id, full_name, email))",
          )
          .eq("is_shared", true)
          .eq("shared_by", currentUser.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (cancelled) return;

        // Group rows whose content+minute matches — that's "one push".
        const groups = new Map<string, PastSharedGoal>();
        for (const row of data ?? []) {
          const r = row as unknown as {
            id: string;
            thrust_area: string;
            title: string;
            description: string | null;
            uom: UoMType;
            target: string;
            target_date: string | null;
            weightage: number;
            created_at: string;
            sheet?:
              | { employee?: { id: string; full_name: string | null; email: string } | null }
              | null;
          };
          const minuteBucket = r.created_at.slice(0, 16); // YYYY-MM-DDTHH:MM
          const key = [
            r.title,
            r.thrust_area,
            r.uom,
            r.target,
            r.target_date ?? "",
            r.weightage,
            minuteBucket,
          ].join("|");
          const recipient =
            r.sheet?.employee?.full_name || r.sheet?.employee?.email || "Unknown";
          const existing = groups.get(key);
          if (existing) {
            existing.recipientCount += 1;
            existing.recipientNames.push(recipient);
            existing.goal_ids.push(r.id);
          } else {
            groups.set(key, {
              key,
              title: r.title,
              thrust_area: r.thrust_area,
              description: r.description,
              uom: r.uom,
              target: r.target,
              target_date: r.target_date,
              weightage: r.weightage,
              created_at: r.created_at,
              recipientCount: 1,
              recipientNames: [recipient],
              goal_ids: [r.id],
            });
          }
        }
        setPastGoals(Array.from(groups.values()));
      } catch (e) {
        if (!cancelled) {
          toast({
            title: "Could not load past shared goals",
            description: e instanceof Error ? e.message : String(e),
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setPastLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pastOpen, currentUser?.id, toast]);

  // Keep the text Target in sync when UoM switches — mirrors GoalForm logic so
  // that TIMELINE/ZERO goals always store a sensible `target` value.
  useEffect(() => {
    if (form.uom === "ZERO" && form.target !== "0") {
      setForm((f) => ({ ...f, target: "0" }));
    }
    if (form.uom === "TIMELINE" && form.target_date) {
      setForm((f) => ({ ...f, target: f.target_date }));
    }
  }, [form.uom, form.target_date, form.target]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .in("role", ["EMPLOYEE", "MANAGER"])
        .order("role", { ascending: true })
        .order("full_name", { ascending: true });
      if (error) {
        toast({
          title: "Could not load recipients",
          description: error.message,
          variant: "destructive",
        });
      }
      setEmployees((data ?? []) as Profile[]);
      setLoading(false);
    })();
  }, [toast]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    clearError("recipients");
  };

  const toggleAll = () => {
    if (selected.size === employees.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(employees.map((e) => e.id)));
    }
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!form.thrust_area.trim()) next.thrust_area = "Thrust area is required";
    if (!form.title.trim()) next.title = "Goal title is required";
    if (form.uom === "TIMELINE") {
      if (!form.target_date.trim()) next.target_date = "Pick a target deadline";
    } else if (form.uom === "NUMERIC" || form.uom === "PERCENT") {
      const n = Number(form.target);
      if (!form.target.trim() || Number.isNaN(n) || n <= 0)
        next.target = "Target must be a positive number";
      else if (form.uom === "PERCENT" && n > 100)
        next.target = "Percent target cannot exceed 100";
    }
    if (selected.size === 0) next.recipients = "Select at least one recipient";
    return next;
  };

  // Look up an existing sheet for this cycle, create a DRAFT one if missing,
  // then insert the shared goal. Sheet conflicts (approved / weightage overflow)
  // bubble up as the returned error message and surface in the result dialog.
  const pushOne = async (row: PrecheckRow): Promise<string | null> => {
    const { data: existingSheet } = await supabase
      .from("goal_sheets")
      .select("id")
      .eq("employee_id", row.employeeId)
      .eq("cycle_year", currentCycleYear)
      .maybeSingle();

    let sheetId = existingSheet?.id ?? null;

    if (!sheetId) {
      const { data: created, error: cErr } = await supabase
        .from("goal_sheets")
        .insert({
          employee_id: row.employeeId,
          cycle_year: currentCycleYear,
          status: "DRAFT",
        })
        .select()
        .single();
      if (cErr) return cErr.message;
      sheetId = created.id;
    }

    const { error: gErr } = await supabase.from("goals").insert({
      sheet_id: sheetId,
      thrust_area: form.thrust_area,
      title: form.title,
      description: form.description.trim() || null,
      uom: form.uom,
      target: form.target,
      target_date: form.uom === "TIMELINE" ? form.target_date : null,
      weightage: form.weightage,
      is_shared: true,
      is_locked: false,
      shared_by: currentUser?.id ?? null,
    });
    if (gErr) return gErr.message;
    return null;
  };

  const handlePushClick = () => {
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      const first = Object.values(fieldErrors)[0];
      toast({
        title: "Fix the highlighted fields",
        description: first,
        variant: "destructive",
      });
      return;
    }
    setErrors({});
    // Build the summary entirely from local state — recipient names already
    // come from the loaded `employees` array, so there's no need to hit
    // Supabase before showing the confirm dialog. Per-sheet conflict detection
    // happens inside `pushOne` at write time and surfaces in the result dialog.
    const rows: PrecheckRow[] = Array.from(selected).map((id) => {
      const profile = employees.find((p) => p.id === id);
      return {
        employeeId: id,
        name: profile?.full_name || profile?.email || id,
        sheetId: null,
        status: null,
        currentTotal: 0,
        available: 100,
        conflict: false,
        reason: "",
      };
    });
    setPrecheck(rows);
    setConfirmOpen(true);
  };

  const executePush = async (rows: PrecheckRow[]) => {
    setPushing(true);
    let success = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const reason = await pushOne(row);
      if (reason) {
        errors.push(`${row.name}: ${reason}`);
      } else {
        success++;
      }
    }

    setPushing(false);
    setConfirmOpen(false);
    setPrecheck([]);

    if (success > 0) {
      const parts: string[] = [];
      if (errors.length > 0) parts.push(`${errors.length} failed`);
      setResult({
        status: "success",
        title: `Pushed to ${success} ${success === 1 ? "recipient" : "recipients"}`,
        message:
          parts.length > 0
            ? parts.join(" · ")
            : "The shared goal is now on their cycle sheet.",
      });
      setForm(EMPTY);
      setSelected(new Set());
    } else if (errors.length > 0) {
      setResult({
        status: "error",
        title: "Push failed",
        message: errors[0],
      });
    } else {
      setResult({
        status: "error",
        title: "Nothing pushed",
        message: "All selected recipients were skipped.",
      });
    }
  };

  // Wipe a shared-goal group from every recipient's sheet. The
  // `goals_delete_admin` RLS policy added in migration 0003 lets this hit.
  // Cascade behaviour (per migration 0001 + 0004): check_ins.goal_id cascades
  // (recorded actuals on this goal are deleted), audit_logs.goal_id is set
  // null (audit row preserved). Recipients whose sheets are APPROVED will
  // drop below the weightage = 100% invariant and need an admin reopen so
  // the employee can rebalance.
  const executeDeletePast = async () => {
    if (!deletingPast) return;
    setDeletingPastBusy(true);
    const { error } = await supabase
      .from("goals")
      .delete()
      .in("id", deletingPast.goal_ids);
    setDeletingPastBusy(false);
    const target = deletingPast;
    setDeletingPast(null);
    if (error) {
      setResult({
        status: "error",
        title: "Could not remove shared goal",
        message: error.message,
      });
      return;
    }
    setPastGoals((prev) => prev.filter((g) => g.key !== target.key));
    setResult({
      status: "success",
      title: "Shared goal removed",
      message: `Removed "${target.title}" from ${target.recipientCount} ${
        target.recipientCount === 1 ? "recipient" : "recipients"
      }. Reopen any approved sheets so the employee can rebalance to 100%.`,
    });
  };

  const allSelected = employees.length > 0 && selected.size === employees.length;

  // Group profiles into the same manager → employee tree the wizard / view-team
  // dialog uses. Employees whose manager isn't in the workspace fall under an
  // "Unassigned" pseudo-manager so they still show up.
  const recipientTree = useMemo<SummaryManagerNode[]>(() => {
    const managers = employees.filter((p) => p.role === "MANAGER");
    const emps = employees.filter((p) => p.role === "EMPLOYEE");
    const map = new Map<string, SummaryManagerNode>();
    managers.forEach((m) => {
      map.set(m.id, {
        mgrId: m.id,
        mgrName: m.full_name || m.email,
        mgrEmail: m.email,
        mgrRole: m.role || "MANAGER",
        isNew: false,
        employees: [],
      });
    });
    const orphans: SummaryEmployeeNode[] = [];
    emps.forEach((e) => {
      const mgrNode = e.manager_id ? map.get(e.manager_id) : null;
      const node: SummaryEmployeeNode = {
        id: e.id,
        full_name: e.full_name || e.email,
        email: e.email,
        isNew: false,
      };
      if (mgrNode) mgrNode.employees.push(node);
      else orphans.push(node);
    });
    const tree = Array.from(map.values());
    if (orphans.length > 0) {
      tree.push({
        mgrName: "Unassigned",
        mgrEmail: "—",
        mgrRole: "—",
        isNew: false,
        employees: orphans,
      });
    }
    return tree;
  }, [employees]);


  const uomMeta = UOM_META[form.uom];
  const numericTarget = Number(form.target) || 0;

  return (
    <div className="space-y-5 max-w-5xl">
      <BlurFade>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">
              Push shared goal
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Author one organisation-wide goal and cascade it to selected
              employees and managers on cycle {currentCycleYear} sheets.
              Recipients can tune weightage only — title and target stay locked.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-sm shrink-0"
            onClick={() => setPastOpen(true)}
          >
            Past shared goals
          </Button>
        </div>
      </BlurFade>

      <BlurFade delay={0.05}>
        <Card className="rounded-md border-border/60 bg-card">
          <CardHeader>
            <CardTitle className="text-base">Goal details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="ta">Thrust area</Label>
                <Input
                  id="ta"
                  placeholder="e.g. Revenue Growth"
                  value={form.thrust_area}
                  onChange={(e) => {
                    setForm({ ...form, thrust_area: e.target.value });
                    clearError("thrust_area");
                  }}
                  aria-invalid={!!errors.thrust_area}
                  className={cn(errors.thrust_area && errorGlowClass)}
                />
                {errors.thrust_area ? (
                  <p className="text-xs text-destructive">{errors.thrust_area}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Strategic theme this goal supports.
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="title">Goal title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Achieve ₹5 Cr revenue"
                  value={form.title}
                  onChange={(e) => {
                    setForm({ ...form, title: e.target.value });
                    clearError("title");
                  }}
                  aria-invalid={!!errors.title}
                  className={cn(errors.title && errorGlowClass)}
                />
                {errors.title ? (
                  <p className="text-xs text-destructive">{errors.title}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Recipients see this verbatim.
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                rows={2}
                placeholder="Why does this matter, and how should employees interpret it?"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="uom">Unit of measure</Label>
                <Select
                  value={form.uom}
                  onValueChange={(v) => setForm({ ...form, uom: v as UoMType })}
                >
                  <SelectTrigger id="uom">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(UOM_META) as UoMType[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {UOM_META[k].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{uomMeta.hint}</p>
              </div>

              {/* Target column — switches based on UoM */}
              <div className="space-y-1">
                {form.uom === "NUMERIC" && (
                  <>
                    <Label htmlFor="target">Target value</Label>
                    <NumericStepper
                      id="target"
                      value={form.target}
                      onChange={(v) => {
                        setForm({ ...form, target: v });
                        clearError("target");
                      }}
                      placeholder="e.g. 50000000"
                      className={cn(errors.target && errorGlowWrapperClass)}
                    />
                    {errors.target && (
                      <p className="text-xs text-destructive">{errors.target}</p>
                    )}
                    <div
                      className={cn(
                        "mt-1 rounded-md border border-primary/30 bg-primary/[0.06] px-2.5 py-1.5",
                        "shadow-[0_0_18px_-10px_color-mix(in_oklch,var(--primary)_55%,transparent)]",
                      )}
                    >
                      <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                        Preview
                      </div>
                      <div className="text-base font-semibold tabular-nums text-primary leading-tight">
                        <NumberTicker value={numericTarget} />
                      </div>
                      {formatLargeNumber(numericTarget) && (
                        <div className="text-[0.65rem] text-muted-foreground">
                          {formatLargeNumber(numericTarget)}
                        </div>
                      )}
                    </div>
                  </>
                )}
                {form.uom === "PERCENT" && (
                  <>
                    <Label htmlFor="target">Target percent</Label>
                    <div
                      className={cn(
                        "flex items-center gap-3 pt-1 rounded-md px-1",
                        errors.target && errorGlowWrapperClass,
                      )}
                    >
                      <div className="flex-1 space-y-1.5">
                        <Slider
                          id="target"
                          value={[Number(form.target) || 0]}
                          min={0}
                          max={100}
                          step={10}
                          onValueChange={(v) => {
                            setForm({ ...form, target: String(v[0] ?? 0) });
                            clearError("target");
                          }}
                        />
                        <div className="flex justify-between text-[0.6rem] text-muted-foreground tabular-nums px-1">
                          {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(
                            (t) => (
                              <span key={t}>{t}</span>
                            ),
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <AnimatedCircularProgress
                          value={Math.max(0, Math.min(100, Number(form.target) || 0))}
                          size={48}
                          strokeWidth={5}
                          showValue={false}
                        />
                        <div className="w-12 text-right text-sm font-semibold tabular-nums text-primary">
                          <NumberTicker
                            value={Math.max(0, Math.min(100, Number(form.target) || 0))}
                            suffix="%"
                          />
                        </div>
                      </div>
                    </div>
                    {errors.target ? (
                      <p className="text-xs text-destructive">{errors.target}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Drag to set in steps of 10. Full marks when achievement ≥ target.
                      </p>
                    )}
                  </>
                )}
                {form.uom === "TIMELINE" && (
                  <>
                    <Label htmlFor="target_date">Target deadline</Label>
                    <Popover
                      open={datePopoverOpen}
                      onOpenChange={setDatePopoverOpen}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          id="target_date"
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-9 rounded-sm",
                            !form.target_date && "text-muted-foreground",
                            errors.target_date && errorGlowClass,
                          )}
                        >
                          <CalendarIcon className="h-3.5 w-3.5 mr-2 opacity-70" />
                          {form.target_date
                            ? format(new Date(form.target_date), "PPP")
                            : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="p-0">
                        <Calendar
                          mode="single"
                          selected={
                            form.target_date
                              ? new Date(form.target_date)
                              : undefined
                          }
                          onSelect={(d) => {
                            if (!d) return;
                            const iso = format(d, "yyyy-MM-dd");
                            setForm({
                              ...form,
                              target_date: iso,
                              target: iso,
                            });
                            clearError("target_date");
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
                    {errors.target_date ? (
                      <p className="text-xs text-destructive">{errors.target_date}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        100% on/before deadline, else 0%. Past dates blocked.
                      </p>
                    )}
                  </>
                )}
                {form.uom === "ZERO" && (
                  <>
                    <Label>Target (locked)</Label>
                    <div
                      className={cn(
                        "relative flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/[0.07] px-3 py-2.5",
                        "shadow-[0_0_18px_-10px_color-mix(in_oklch,var(--destructive)_55%,transparent)]",
                      )}
                    >
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60 motion-safe:animate-ping" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
                      </span>
                      <div className="text-3xl font-semibold tabular-nums text-destructive leading-none">
                        0
                      </div>
                      <div className="flex-1">
                        <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                          Zero tolerance
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Locked at zero — any non-zero incident scores 0%.
                        </div>
                      </div>
                      <Lock className="h-3.5 w-3.5 text-destructive/70" />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Weightage — full-width slider on its own row */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="wt">Weightage (%)</Label>
                <span className="text-xs text-muted-foreground">
                  steps of 10 · minimum 10%
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1 space-y-1.5">
                  <Slider
                    id="wt"
                    value={[form.weightage]}
                    min={10}
                    max={100}
                    step={10}
                    onValueChange={(v) =>
                      setForm({ ...form, weightage: v[0] ?? 10 })
                    }
                  />
                  <div className="flex justify-between text-[0.6rem] text-muted-foreground tabular-nums px-1">
                    {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-1.5 min-w-[110px] shrink-0">
                  <AnimatedCircularProgress
                    value={form.weightage}
                    size={36}
                    strokeWidth={4}
                    showValue={false}
                  />
                  <div className="leading-tight">
                    <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
                      Share
                    </div>
                    <div className="text-sm font-semibold tabular-nums">
                      <NumberTicker value={form.weightage} suffix="%" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      <BlurFade delay={0.1}>
        <Card
          className={cn(
            "rounded-md border-border/60 bg-card transition-shadow",
            errors.recipients && errorGlowClass,
          )}
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              Recipients
              <Badge
                variant="outline"
                className="rounded-full border-border/60 text-xs"
              >
                <NumberTicker value={selected.size} />
                <span className="opacity-60 mx-0.5">/</span>
                <NumberTicker value={employees.length} />
              </Badge>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              className="rounded-sm"
              onClick={toggleAll}
              disabled={loading || employees.length === 0}
            >
              {allSelected ? "Clear all" : "Select all"}
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading recipients…</p>
            ) : employees.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No employees or managers found.
              </p>
            ) : (
              <TeamTree
                admin={{
                  name: currentUser?.full_name || currentUser?.email || "Admin",
                  email: currentUser?.email || "",
                  role: currentUser?.role || "ADMIN",
                }}
                tree={recipientTree}
                selection={{ selected, onToggle: toggle }}
              />
            )}
          </CardContent>
        </Card>
      </BlurFade>

      <div className="flex justify-end">
        <Button
          onClick={handlePushClick}
          disabled={pushing || selected.size === 0}
          className="rounded-sm"
        >
          {pushing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {pushing
            ? "Working…"
            : `Push to ${selected.size} recipient${selected.size === 1 ? "" : "s"}`}
        </Button>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => {
          if (!pushing) setConfirmOpen(o);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden rounded-md border border-border/60 bg-card/80 p-5 text-foreground shadow-2xl shadow-black/40 backdrop-blur-md sm:max-w-lg"
        >
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Push this goal?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This will land on {precheck.length}{" "}
              {precheck.length === 1 ? "recipient's" : "recipients'"} cycle{" "}
              {currentCycleYear} sheet
              {precheck.length === 1 ? "" : "s"}.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-3 max-h-[50vh] overflow-y-auto scrollbar-hide pr-1">
            {/* ----------- Goal summary ----------- */}
            <div className="rounded-md border border-border/60 bg-card/60 p-3 space-y-2.5">
              <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                Goal to push
              </div>
              <div>
                <div className="text-sm font-semibold leading-tight">
                  {form.title || "Untitled goal"}
                </div>
                {form.description.trim() && (
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {form.description}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <SummaryStat label="Thrust" value={form.thrust_area || "—"} />
                <SummaryStat label="UoM" value={UOM_META[form.uom].label.split(" — ")[0]} />
                <SummaryStat
                  label="Target"
                  value={
                    form.uom === "TIMELINE"
                      ? form.target_date
                        ? format(new Date(form.target_date), "PP")
                        : "—"
                      : form.uom === "ZERO"
                        ? "0 (locked)"
                        : form.target || "—"
                  }
                />
                <SummaryStat
                  label="Weightage"
                  value={`${form.weightage}%`}
                />
              </div>
            </div>

            {/* ----------- Recipient list ----------- */}
            {precheck.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Recipients
                  <span className="opacity-70 ml-1">({precheck.length})</span>
                </div>
                <div className="rounded-md border border-border/60 overflow-hidden">
                  {precheck.map((r, i) => (
                    <div
                      key={r.employeeId}
                      className={cn(
                        "flex items-center justify-between gap-3 px-3 py-2 text-sm",
                        i !== precheck.length - 1 && "border-b border-border/60",
                      )}
                    >
                      <div className="font-medium truncate">{r.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-2 sm:justify-center">
            <Button
              variant="ghost"
              className="rounded-sm"
              disabled={pushing}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-sm"
              disabled={pushing}
              onClick={() => void executePush(precheck)}
            >
              {pushing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Yes, push to {precheck.length}{" "}
              {precheck.length === 1 ? "recipient" : "recipients"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------- Past shared goals dialog -------------------- */}
      <Dialog open={pastOpen} onOpenChange={setPastOpen}>
        <DialogContent className="sm:max-w-2xl rounded-md border-border/60 bg-card shadow-2xl shadow-black/40">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight leading-tight">
              Past shared goals
            </DialogTitle>
            <DialogDescription className="text-sm/relaxed">
              Goals you've previously pushed to teammates' sheets.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[65vh] overflow-y-auto scrollbar-hide pr-1">
            {pastLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : pastGoals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No shared goals yet. Push one above to see it here.
              </p>
            ) : (
              pastGoals.map((g) => (
                <div
                  key={g.key}
                  className="rounded-md border border-border/60 bg-card p-3 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-tight">
                        {g.title}
                      </div>
                      {g.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {g.description}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-[0.65rem] text-muted-foreground tabular-nums">
                        {format(new Date(g.created_at), "PP")}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeletingPast(g)}
                        aria-label={`Remove shared goal "${g.title}"`}
                        className="rounded-sm text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <SummaryStat label="Thrust" value={g.thrust_area || "—"} />
                    <SummaryStat
                      label="UoM"
                      value={UOM_META[g.uom].label.split(" — ")[0]}
                    />
                    <SummaryStat
                      label="Target"
                      value={
                        g.uom === "TIMELINE"
                          ? g.target_date
                            ? format(new Date(g.target_date), "PP")
                            : "—"
                          : g.uom === "ZERO"
                            ? "0 (locked)"
                            : g.target || "—"
                      }
                    />
                    <SummaryStat
                      label="Weightage"
                      value={`${g.weightage}%`}
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Badge
                      variant="outline"
                      className="rounded-full border-primary/40 bg-primary/10 text-primary text-[0.65rem]"
                    >
                      {g.recipientCount}{" "}
                      {g.recipientCount === 1 ? "recipient" : "recipients"}
                    </Badge>
                    <div
                      className="text-xs text-muted-foreground truncate"
                      title={g.recipientNames.join(", ")}
                    >
                      {g.recipientNames.slice(0, 4).join(", ")}
                      {g.recipientNames.length > 4 &&
                        ` +${g.recipientNames.length - 4} more`}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-sm"
              onClick={() => setPastOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------- Delete a past shared goal confirm ------------- */}
      <Dialog
        open={!!deletingPast}
        onOpenChange={(o) => {
          if (!deletingPastBusy && !o) setDeletingPast(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden rounded-md border border-border/60 bg-card p-5 text-foreground shadow-2xl shadow-black/40 sm:max-w-md"
        >
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Remove this shared goal?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Wipes <strong>{deletingPast?.title}</strong> from{" "}
              {deletingPast?.recipientCount}{" "}
              {deletingPast?.recipientCount === 1 ? "recipient's" : "recipients'"}{" "}
              sheet
              {deletingPast?.recipientCount === 1 ? "" : "s"}. Any check-ins
              recorded against this goal are deleted (audit log entries are
              preserved). Approved sheets will drop below 100% weightage —
              reopen them so the employee can rebalance. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-4 gap-2 sm:gap-2 sm:justify-center">
            <Button
              variant="ghost"
              className="rounded-sm"
              disabled={deletingPastBusy}
              onClick={() => setDeletingPast(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-sm"
              disabled={deletingPastBusy}
              onClick={() => void executeDeletePast()}
            >
              {deletingPastBusy && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              {deletingPastBusy ? "Removing…" : "Yes, remove from all"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------- Outcome dialog (success / error) ------------- */}
      <Dialog
        open={!!result}
        onOpenChange={(o) => {
          if (!o) setResult(null);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden rounded-md border border-border/60 bg-card/80 p-5 text-foreground shadow-2xl shadow-black/40 backdrop-blur-md sm:max-w-md"
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
              onClick={() => {
                const wasSuccess = result?.status === "success";
                setResult(null);
                if (wasSuccess) {
                  // AppShell's <main> is the scroll container — the window
                  // itself doesn't scroll because of `h-screen overflow-hidden`.
                  document
                    .querySelector("main")
                    ?.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
            >
              {result?.status === "success" ? "OK" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-card/70 px-2.5 py-1.5">
      <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-xs font-medium tabular-nums truncate" title={value}>
        {value}
      </div>
    </div>
  );
}
