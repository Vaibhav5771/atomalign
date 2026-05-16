import { useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/authStore";
import { currentCycleYear } from "@/stores/goalSheetStore";
import type { Profile, SheetStatus, UoMType } from "@/types";

interface FormState {
  thrust_area: string;
  title: string;
  description: string;
  uom: UoMType;
  target: string;
  weightage: number;
}

const EMPTY: FormState = {
  thrust_area: "",
  title: "",
  description: "",
  uom: "NUMERIC",
  target: "",
  weightage: 10,
};

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

const REOPEN_REMARK =
  "[Reopened by admin] A shared goal was pushed to this sheet. Please rebalance weightages and resubmit for re-approval.";

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

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "EMPLOYEE")
        .order("full_name", { ascending: true });
      if (error) {
        toast({ title: "Could not load employees", description: error.message, variant: "destructive" });
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
  };

  const toggleAll = () => {
    if (selected.size === employees.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(employees.map((e) => e.id)));
    }
  };

  const validate = (): string | null => {
    if (!form.thrust_area.trim()) return "Thrust area is required";
    if (!form.title.trim()) return "Title is required";
    if (!form.target.trim()) return "Target is required";
    if (form.weightage < 10 || form.weightage > 100) return "Weightage must be between 10 and 100";
    if (selected.size === 0) return "Select at least one employee";
    return null;
  };

  const runPrecheck = async (employeeIds: string[]): Promise<PrecheckRow[]> => {
    const rows: PrecheckRow[] = [];
    for (const empId of employeeIds) {
      const profile = employees.find((p) => p.id === empId);
      const name = profile?.full_name || profile?.email || empId;

      const { data: sheet } = await supabase
        .from("goal_sheets")
        .select("id, status")
        .eq("employee_id", empId)
        .eq("cycle_year", currentCycleYear)
        .maybeSingle();

      if (!sheet) {
        rows.push({
          employeeId: empId,
          name,
          sheetId: null,
          status: null,
          currentTotal: 0,
          available: 100,
          conflict: false,
          reason: "No sheet yet — will be created",
        });
        continue;
      }

      const { data: goals } = await supabase
        .from("goals")
        .select("weightage")
        .eq("sheet_id", sheet.id);

      const currentTotal = (goals ?? []).reduce(
        (sum, g: { weightage: number }) => sum + (g.weightage || 0),
        0,
      );
      const available = 100 - currentTotal;
      const isApproved = sheet.status === "APPROVED";
      const overflow = form.weightage > available;
      const conflict = isApproved || overflow;

      let reason = "";
      if (isApproved && overflow) {
        reason = `Sheet is APPROVED and total would become ${currentTotal + form.weightage}%`;
      } else if (isApproved) {
        reason = "Sheet is APPROVED — goals are locked";
      } else if (overflow) {
        reason = `Only ${available}% available — push would make total ${currentTotal + form.weightage}%`;
      } else {
        reason = `Total will be ${currentTotal + form.weightage}%`;
      }

      rows.push({
        employeeId: empId,
        name,
        sheetId: sheet.id,
        status: sheet.status as SheetStatus,
        currentTotal,
        available,
        conflict,
        reason,
      });
    }
    return rows;
  };

  const pushOne = async (row: PrecheckRow): Promise<string | null> => {
    let sheetId = row.sheetId;

    // Create sheet if missing
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
      weightage: form.weightage,
      is_shared: true,
      is_locked: false,
      shared_by: currentUser?.id ?? null,
    });
    if (gErr) return gErr.message;
    return null;
  };

  const reopenAndPush = async (row: PrecheckRow): Promise<string | null> => {
    if (!row.sheetId) return pushOne(row);

    // 1. Unlock all goals on the sheet. .select() lets us detect silent RLS
    //    failures: zero rows returned where rows were expected.
    const { data: unlocked, error: unlockErr } = await supabase
      .from("goals")
      .update({ is_locked: false })
      .eq("sheet_id", row.sheetId)
      .select("id, is_locked");
    if (unlockErr) return unlockErr.message;
    if (!unlocked || unlocked.length === 0) {
      return "Could not unlock goals — admin update policy missing. Apply migration 0003_admin_reopen.sql.";
    }

    // 2. Move sheet back to RETURNED with a remark and reopen attribution.
    //    .single() throws if RLS silently returns 0 rows.
    const { data: updatedSheet, error: sErr } = await supabase
      .from("goal_sheets")
      .update({
        status: "RETURNED",
        manager_remark: REOPEN_REMARK,
        submitted_at: null,
        approved_at: null,
        reopened_by: currentUser?.id ?? null,
        reopened_at: new Date().toISOString(),
      })
      .eq("id", row.sheetId)
      .select()
      .single();
    if (sErr) return sErr.message;
    if (!updatedSheet) {
      return "Could not reopen sheet — admin update policy missing. Apply migration 0003_admin_reopen.sql.";
    }

    // 3. Audit log for the reopen
    if (currentUser?.id) {
      await supabase.from("audit_logs").insert({
        sheet_id: row.sheetId,
        changed_by: currentUser.id,
        action: "REOPEN_BY_ADMIN",
        new_value: { status: "RETURNED", reason: REOPEN_REMARK },
      });
    }

    // 4. Insert the shared goal
    return pushOne(row);
  };

  const handlePushClick = async () => {
    const err = validate();
    if (err) {
      toast({ title: "Cannot push", description: err, variant: "destructive" });
      return;
    }
    setPushing(true);
    const rows = await runPrecheck(Array.from(selected));
    setPushing(false);

    const anyConflict = rows.some((r) => r.conflict);
    if (!anyConflict) {
      // Straight through
      await executePush(rows, /*reopen*/ false);
      return;
    }

    // Show confirmation modal
    setPrecheck(rows);
    setConfirmOpen(true);
  };

  const executePush = async (rows: PrecheckRow[], reopenConflicts: boolean) => {
    setPushing(true);
    let success = 0;
    let skipped = 0;
    let reopened = 0;
    const errors: string[] = [];

    for (const row of rows) {
      if (row.conflict && !reopenConflicts) {
        skipped++;
        continue;
      }
      const reason =
        row.conflict && reopenConflicts ? await reopenAndPush(row) : await pushOne(row);
      if (reason) {
        errors.push(`${row.name}: ${reason}`);
      } else {
        success++;
        if (row.conflict) reopened++;
      }
    }

    setPushing(false);
    setConfirmOpen(false);
    setPrecheck([]);

    if (success > 0) {
      const parts: string[] = [];
      if (reopened > 0) parts.push(`${reopened} sheet${reopened > 1 ? "s" : ""} reopened`);
      if (skipped > 0) parts.push(`${skipped} skipped`);
      if (errors.length > 0) parts.push(`${errors.length} failed`);
      toast({
        title: `Pushed to ${success} employee${success > 1 ? "s" : ""}`,
        description: parts.join(" · ") || undefined,
      });
      setForm(EMPTY);
      setSelected(new Set());
    } else if (errors.length > 0) {
      toast({ title: "Push failed", description: errors[0], variant: "destructive" });
    } else {
      toast({
        title: "Nothing pushed",
        description: "All selected recipients were skipped.",
        variant: "destructive",
      });
    }
  };

  const allSelected = employees.length > 0 && selected.size === employees.length;

  const conflicts = precheck.filter((r) => r.conflict);
  const clean = precheck.filter((r) => !r.conflict);

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Push shared goal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a goal and push it to the goal sheets of selected employees. Recipients can change
          weightage only; title and target are locked.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Goal details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ta">Thrust area</Label>
              <Input
                id="ta"
                value={form.thrust_area}
                onChange={(e) => setForm({ ...form, thrust_area: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="title">Goal title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="desc">Description (optional)</Label>
            <Textarea
              id="desc"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="uom">UoM</Label>
              <Select
                value={form.uom}
                onValueChange={(v) => setForm({ ...form, uom: v as UoMType })}
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
              <Input
                id="target"
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wt">Weightage (%)</Label>
              <Input
                id="wt"
                type="number"
                step={1}
                inputMode="numeric"
                value={form.weightage}
                onChange={(e) => setForm({ ...form, weightage: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recipients</CardTitle>
          <Button variant="outline" size="sm" onClick={toggleAll} disabled={loading}>
            {allSelected ? "Clear all" : "Select all"}
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading employees…</p>
          ) : employees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No employees found.</p>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              {employees.map((e) => (
                <label
                  key={e.id}
                  className="flex items-center gap-2 px-2 py-1.5 border border-border hover:bg-accent cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(e.id)}
                    onChange={() => toggle(e.id)}
                  />
                  <div className="text-sm">
                    <div className="font-medium">{e.full_name || e.email}</div>
                    <div className="text-xs text-muted-foreground">{e.email}</div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handlePushClick}
          disabled={pushing || selected.size === 0}
        >
          {pushing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {pushing
            ? "Working…"
            : `Push to ${selected.size} employee${selected.size === 1 ? "" : "s"}`}
        </Button>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => {
          if (!pushing) setConfirmOpen(o);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Some recipients need their sheet reopened
            </DialogTitle>
            <DialogDescription>
              The shared goal can't fit on the sheets below as-is. Reopening will set the sheet to
              RETURNED, unlock all goals so the employee can rebalance, and notify them with a
              remark. Manager will need to re-approve.
            </DialogDescription>
          </DialogHeader>

          {conflicts.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">
                Will need reopen ({conflicts.length})
              </div>
              <div className="border border-amber-300 bg-amber-50 dark:bg-amber-900/10">
                {conflicts.map((r) => (
                  <div
                    key={r.employeeId}
                    className="flex items-start justify-between gap-3 px-3 py-2 border-b border-amber-200 last:border-b-0 text-sm"
                  >
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.reason}</div>
                    </div>
                    <Badge
                      variant="outline"
                      className="bg-amber-100 text-amber-800 border-amber-300"
                    >
                      {r.status ?? "—"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {clean.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Will push cleanly ({clean.length})</div>
              <div className="border border-border">
                {clean.map((r) => (
                  <div
                    key={r.employeeId}
                    className="flex items-start justify-between gap-3 px-3 py-2 border-b border-border last:border-b-0 text-sm"
                  >
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.reason}</div>
                    </div>
                    <Badge variant="outline">{r.status ?? "NEW"}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={pushing}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              disabled={pushing || clean.length === 0}
              onClick={() => void executePush(precheck, false)}
            >
              {pushing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Skip conflicts · push to {clean.length}
            </Button>
            <Button
              disabled={pushing}
              onClick={() => void executePush(precheck, true)}
            >
              {pushing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Reopen &amp; push to {precheck.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
