import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { currentCycleYear } from "@/stores/goalSheetStore";
import type { Profile, UoMType } from "@/types";

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

export default function SharedGoalsPage() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [pushing, setPushing] = useState(false);

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

  const handlePush = async () => {
    const err = validate();
    if (err) {
      toast({ title: "Cannot push", description: err, variant: "destructive" });
      return;
    }
    setPushing(true);
    const employeeIds = Array.from(selected);
    let success = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const empId of employeeIds) {
      // 1. Get or create the employee's sheet for the current cycle
      const { data: existing } = await supabase
        .from("goal_sheets")
        .select("*")
        .eq("employee_id", empId)
        .eq("cycle_year", currentCycleYear)
        .maybeSingle();

      let sheetId: string | null = existing?.id ?? null;
      if (!sheetId) {
        const { data: created, error: cErr } = await supabase
          .from("goal_sheets")
          .insert({
            employee_id: empId,
            cycle_year: currentCycleYear,
            status: "DRAFT",
          })
          .select()
          .single();
        if (cErr) {
          errors.push(`${empId}: ${cErr.message}`);
          continue;
        }
        sheetId = created.id;
      }

      if (existing && existing.status === "APPROVED") {
        skipped++;
        continue;
      }

      // 2. Insert goal into employee's sheet
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
      });
      if (gErr) {
        errors.push(`${empId}: ${gErr.message}`);
        continue;
      }
      success++;
    }

    setPushing(false);

    if (success > 0) {
      toast({
        title: `Pushed to ${success} employee${success > 1 ? "s" : ""}`,
        description:
          (skipped ? `Skipped ${skipped} approved sheet${skipped > 1 ? "s" : ""}. ` : "") +
          (errors.length ? `${errors.length} failed.` : ""),
      });
      setForm(EMPTY);
      setSelected(new Set());
    } else if (errors.length) {
      toast({
        title: "Push failed",
        description: errors[0],
        variant: "destructive",
      });
    } else {
      toast({
        title: "Nothing pushed",
        description: "All selected sheets are already approved.",
        variant: "destructive",
      });
    }
  };

  const allSelected = employees.length > 0 && selected.size === employees.length;

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
          onClick={handlePush}
          disabled={pushing || selected.size === 0}
        >
          {pushing && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          {pushing
            ? "Pushing…"
            : `Push to ${selected.size} employee${selected.size === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}
