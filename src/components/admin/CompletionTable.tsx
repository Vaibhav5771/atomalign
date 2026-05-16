import { useMemo, useState } from "react";
import { CheckCircle2, Clock, Minus } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QUARTERS, currentQuarter } from "@/lib/utils";
import type { CompletionRow, CompletionState } from "@/stores/reportsStore";
import type { Quarter } from "@/types";

interface Props {
  rows: CompletionRow[];
  loading?: boolean;
}

const ALL_MANAGERS = "__ALL__";

function Cell({ state }: { state: CompletionState }) {
  if (state === "COMPLETED") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
        <CheckCircle2 className="h-4 w-4" />
        Completed
      </span>
    );
  }
  if (state === "IN_PROGRESS") {
    return (
      <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
        <Clock className="h-4 w-4" />
        In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Minus className="h-4 w-4" />
      Not Started
    </span>
  );
}

export function CompletionTable({ rows, loading }: Props) {
  const [managerFilter, setManagerFilter] = useState<string>(ALL_MANAGERS);

  const managerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.manager_id && r.manager_name) {
        map.set(r.manager_id, r.manager_name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    if (managerFilter === ALL_MANAGERS) return rows;
    return rows.filter((r) => r.manager_id === managerFilter);
  }, [rows, managerFilter]);

  const summary = useMemo(() => {
    const stats: Record<Quarter, { completed: number; total: number }> = {
      Q1: { completed: 0, total: filtered.length },
      Q2: { completed: 0, total: filtered.length },
      Q3: { completed: 0, total: filtered.length },
      Q4: { completed: 0, total: filtered.length },
    };
    for (const r of filtered) {
      for (const q of QUARTERS) {
        if (r.quarters[q] === "COMPLETED") stats[q].completed++;
      }
    }
    return stats;
  }, [filtered]);

  const focusQ = currentQuarter();

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <p className="text-sm">
          <span className="font-semibold tabular-nums">
            {summary[focusQ].completed} of {summary[focusQ].total}
          </span>{" "}
          employees completed {focusQ} check-ins
        </p>
        <div className="min-w-[14rem]">
          <Label htmlFor="manager_filter" className="text-xs">
            Filter by manager
          </Label>
          <Select value={managerFilter} onValueChange={setManagerFilter}>
            <SelectTrigger id="manager_filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_MANAGERS}>All managers</SelectItem>
              {managerOptions.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Manager</TableHead>
              {QUARTERS.map((q) => (
                <TableHead key={q} className="w-32">
                  {q}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                  Loading…
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                  No employees match this filter.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.employee_id}>
                  <TableCell className="font-medium">
                    <div>{r.employee_name}</div>
                    {r.department && (
                      <div className="text-xs text-muted-foreground">{r.department}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{r.manager_name ?? "—"}</TableCell>
                  {QUARTERS.map((q) => (
                    <TableCell key={q}>
                      <Cell state={r.quarters[q]} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
