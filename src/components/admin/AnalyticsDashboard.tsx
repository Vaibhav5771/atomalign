import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, currentQuarter, QUARTERS } from "@/lib/utils";
import type { AnalyticsRow, Quarter } from "@/types";

// -----------------------------------------------------------------------------
// Shared helpers
// -----------------------------------------------------------------------------
const PIE_COLORS = [
  "#2563eb", "#16a34a", "#d97706", "#dc2626",
  "#7c3aed", "#0891b2", "#be185d", "#65a30d",
];

function scoreClass(score: number | null) {
  if (score == null) return "text-muted-foreground";
  if (score >= 100) return "text-emerald-600";
  if (score >= 75) return "text-amber-600";
  return "text-rose-600";
}

function rateClass(rate: number) {
  if (rate > 80) return "text-emerald-600";
  if (rate >= 50) return "text-amber-600";
  return "text-rose-600";
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-64 text-sm text-muted-foreground border border-dashed border-border rounded">
      {label}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-64 rounded bg-muted/40 animate-pulse" />
  );
}

// -----------------------------------------------------------------------------
// Chart 1 — QoQ Achievement Trend (line)
// -----------------------------------------------------------------------------
function QoQTrendChart({
  rows,
  loading,
}: {
  rows: AnalyticsRow[];
  loading: boolean;
}) {
  const [mode, setMode] = useState<"org" | "dept">("org");

  // Filter to rows that have a quarter (i.e. an actual check-in exists)
  const withScore = useMemo(
    () => rows.filter((r) => r.quarter && r.score != null),
    [rows],
  );

  // Depts present in the data
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const r of withScore) if (r.department) set.add(r.department);
    return Array.from(set).sort();
  }, [withScore]);

  // Aggregate per quarter
  const data = useMemo(() => {
    const out = QUARTERS.map((q) => {
      const point: Record<string, string | number> = { quarter: q };
      if (mode === "org") {
        const slice = withScore.filter((r) => r.quarter === q);
        if (slice.length > 0) {
          const avg =
            slice.reduce((s, r) => s + (r.score ?? 0), 0) / slice.length;
          point.Org = Math.round(avg * 10) / 10;
        }
      } else {
        for (const d of departments) {
          const slice = withScore.filter(
            (r) => r.quarter === q && r.department === d,
          );
          if (slice.length > 0) {
            const avg =
              slice.reduce((s, r) => s + (r.score ?? 0), 0) / slice.length;
            point[d] = Math.round(avg * 10) / 10;
          }
        }
      }
      return point;
    });
    return out;
  }, [withScore, mode, departments]);

  const lineKeys = mode === "org" ? ["Org"] : departments;
  const isEmpty = withScore.length === 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">QoQ Achievement Trend</CardTitle>
            <CardDescription>
              Average check-in score by quarter
              {mode === "dept" ? " (per department)" : " (whole organisation)"}
            </CardDescription>
          </div>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={mode === "org" ? "default" : "outline"}
              onClick={() => setMode("org")}
            >
              Whole org
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "dept" ? "default" : "outline"}
              onClick={() => setMode("dept")}
              disabled={departments.length === 0}
            >
              Per dept
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartSkeleton />
        ) : isEmpty ? (
          <EmptyChart label="No data yet — no check-ins recorded across any quarter." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="quarter" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis
                  domain={[0, 100]}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {lineKeys.map((key, i) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={PIE_COLORS[i % PIE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Chart 2 — Goal Distribution (3 pies via tabs)
// -----------------------------------------------------------------------------
type DistTab = "thrust" | "uom" | "status";

function GoalDistributionChart({
  rows,
  loading,
}: {
  rows: AnalyticsRow[];
  loading: boolean;
}) {
  const [tab, setTab] = useState<DistTab>("thrust");

  // Distinct goals (rows have duplicate goal_id for goals with multiple check-ins)
  const goals = useMemo(() => {
    const seen = new Map<string, AnalyticsRow>();
    for (const r of rows) if (!seen.has(r.goal_id)) seen.set(r.goal_id, r);
    return Array.from(seen.values());
  }, [rows]);

  // Check-in status counts come from rows that DO have a checkin_status
  const checkInsForStatus = useMemo(
    () => rows.filter((r) => r.checkin_status != null),
    [rows],
  );

  const data = useMemo(() => {
    const counts = new Map<string, number>();
    if (tab === "thrust") {
      for (const g of goals)
        counts.set(g.thrust_area, (counts.get(g.thrust_area) ?? 0) + 1);
    } else if (tab === "uom") {
      for (const g of goals) counts.set(g.uom, (counts.get(g.uom) ?? 0) + 1);
    } else {
      for (const c of checkInsForStatus) {
        const k = c.checkin_status as string;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    return Array.from(counts.entries())
      .map(([name, value]) => ({
        name,
        value,
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [tab, goals, checkInsForStatus]);

  const tabs: { id: DistTab; label: string }[] = [
    { id: "thrust", label: "Thrust Area" },
    { id: "uom", label: "UoM" },
    { id: "status", label: "Status" },
  ];

  const isEmpty = data.length === 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">Goal Distribution</CardTitle>
            <CardDescription>
              Breakdown of goals by thrust area, unit of measure, or check-in status.
            </CardDescription>
          </div>
          <div className="flex gap-1.5">
            {tabs.map((t) => (
              <Button
                key={t.id}
                type="button"
                size="sm"
                variant={tab === t.id ? "default" : "outline"}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartSkeleton />
        ) : isEmpty ? (
          <EmptyChart label="No data yet — no goals match this view." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={(entry) => {
                    const p = (entry as { payload?: { name: string; value: number; pct: number } })
                      .payload;
                    return p ? `${p.name} (${p.value} · ${p.pct}%)` : "";
                  }}
                  labelLine={false}
                  fontSize={11}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, _name, entry) => {
                    const pct = (entry as { payload?: { pct: number } }).payload?.pct;
                    return pct != null ? `${v} (${pct}%)` : String(v);
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Per-manager aggregates — drives Chart 3 and Chart 4
// -----------------------------------------------------------------------------
interface ManagerStats {
  manager_id: string;
  manager_name: string;
  team_size: number;
  goals_approved: number;
  avg_score: number | null;
  completion_rate: number; // 0-100
}

function buildManagerStats(rows: AnalyticsRow[], focusQ: Quarter): ManagerStats[] {
  // Group by manager
  const byManager = new Map<string, AnalyticsRow[]>();
  for (const r of rows) {
    if (!r.manager_id) continue;
    const list = byManager.get(r.manager_id) ?? [];
    list.push(r);
    byManager.set(r.manager_id, list);
  }

  const out: ManagerStats[] = [];
  for (const [mid, mrows] of byManager) {
    // Distinct employees under this manager
    const employees = new Map<string, AnalyticsRow[]>();
    for (const r of mrows) {
      const list = employees.get(r.employee_id) ?? [];
      list.push(r);
      employees.set(r.employee_id, list);
    }

    // Goals on APPROVED sheets only
    const approvedGoals = new Set<string>();
    for (const r of mrows) if (r.sheet_status === "APPROVED") approvedGoals.add(r.goal_id);

    // Average check-in score across all rows with a score
    const scoreRows = mrows.filter((r) => r.score != null);
    const avgScore =
      scoreRows.length > 0
        ? scoreRows.reduce((s, r) => s + (r.score ?? 0), 0) / scoreRows.length
        : null;

    // Completion rate for the current quarter:
    //   for each employee, check whether EVERY goal on their APPROVED sheet
    //   has a check_in with status COMPLETED for focusQ.
    let completedEmployees = 0;
    let trackedEmployees = 0;
    for (const [, erows] of employees) {
      const approvedGoalIds = new Set(
        erows.filter((r) => r.sheet_status === "APPROVED").map((r) => r.goal_id),
      );
      if (approvedGoalIds.size === 0) continue;
      trackedEmployees++;
      // for each goal id, find a row matching focusQ with COMPLETED
      const completedGoalIds = new Set(
        erows
          .filter(
            (r) =>
              r.quarter === focusQ &&
              r.checkin_status === "COMPLETED" &&
              approvedGoalIds.has(r.goal_id),
          )
          .map((r) => r.goal_id),
      );
      if (completedGoalIds.size === approvedGoalIds.size) completedEmployees++;
    }
    const completionRate = trackedEmployees > 0 ? (completedEmployees / trackedEmployees) * 100 : 0;

    out.push({
      manager_id: mid,
      manager_name: mrows[0].manager_name ?? "—",
      team_size: employees.size,
      goals_approved: approvedGoals.size,
      avg_score: avgScore == null ? null : Math.round(avgScore * 10) / 10,
      completion_rate: Math.round(completionRate * 10) / 10,
    });
  }

  return out;
}

// -----------------------------------------------------------------------------
// Chart 3 — Team Completion Rate (horizontal bar)
// -----------------------------------------------------------------------------
function TeamCompletionChart({
  managerStats,
  loading,
  focusQ,
}: {
  managerStats: ManagerStats[];
  loading: boolean;
  focusQ: Quarter;
}) {
  const isEmpty = managerStats.length === 0;
  const data = useMemo(
    () =>
      [...managerStats].sort((a, b) => b.completion_rate - a.completion_rate),
    [managerStats],
  );

  const barColor = (rate: number) => {
    if (rate > 80) return "#16a34a";
    if (rate >= 50) return "#d97706";
    return "#dc2626";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Team Completion Rate · {focusQ}</CardTitle>
        <CardDescription>
          Share of each manager's team that has every goal completed for the current quarter.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartSkeleton />
        ) : isEmpty ? (
          <EmptyChart label="No data yet — no managers have direct reports with approved goals." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="manager_name"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  width={80}
                />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="completion_rate" name="Completion %">
                  {data.map((row, i) => (
                    <Cell key={i} fill={barColor(row.completion_rate)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Chart 4 — Manager Effectiveness (table)
// -----------------------------------------------------------------------------
function ManagerEffectivenessTable({
  managerStats,
  loading,
}: {
  managerStats: ManagerStats[];
  loading: boolean;
}) {
  const sorted = useMemo(
    () =>
      [...managerStats].sort((a, b) => b.completion_rate - a.completion_rate),
    [managerStats],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Manager Effectiveness</CardTitle>
        <CardDescription>
          Direct-report counts, approved-goal counts, average check-in score, and completion rate
          for the current quarter. Sorted by completion rate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ChartSkeleton />
        ) : sorted.length === 0 ? (
          <EmptyChart label="No data yet — no managers have direct reports." />
        ) : (
          <div className="rounded border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Manager</TableHead>
                  <TableHead className="text-right">Team Size</TableHead>
                  <TableHead className="text-right">Goals Approved</TableHead>
                  <TableHead className="text-right">Avg Check-in Score</TableHead>
                  <TableHead className="text-right">Completion Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((m) => (
                  <TableRow key={m.manager_id}>
                    <TableCell className="font-medium">{m.manager_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.team_size}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.goals_approved}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums font-semibold",
                        scoreClass(m.avg_score),
                      )}
                    >
                      {m.avg_score == null ? "—" : `${m.avg_score.toFixed(1)}%`}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums font-semibold",
                        rateClass(m.completion_rate),
                      )}
                    >
                      {m.completion_rate.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// -----------------------------------------------------------------------------
// Dashboard composition
// -----------------------------------------------------------------------------
interface Props {
  rows: AnalyticsRow[];
  loading: boolean;
}

export function AnalyticsDashboard({ rows, loading }: Props) {
  const focusQ = currentQuarter();
  const managerStats = useMemo(() => buildManagerStats(rows, focusQ), [rows, focusQ]);

  // Top-of-page snapshot stats
  const stats = useMemo(() => {
    const employees = new Set(rows.map((r) => r.employee_id));
    const goals = new Set(rows.map((r) => r.goal_id));
    const approved = new Set(
      rows.filter((r) => r.sheet_status === "APPROVED").map((r) => r.goal_id),
    );
    const checkIns = rows.filter((r) => r.checkin_status != null).length;
    return {
      employees: employees.size,
      goals: goals.size,
      approvedGoals: approved.size,
      checkIns,
    };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Employees tracked" value={stats.employees} loading={loading} />
        <Stat label="Goals total" value={stats.goals} loading={loading} />
        <Stat label="Goals approved" value={stats.approvedGoals} loading={loading} />
        <Stat label="Check-ins recorded" value={stats.checkIns} loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <QoQTrendChart rows={rows} loading={loading} />
        <GoalDistributionChart rows={rows} loading={loading} />
        <TeamCompletionChart
          managerStats={managerStats}
          loading={loading}
          focusQ={focusQ}
        />
        <ManagerEffectivenessTable managerStats={managerStats} loading={loading} />
      </div>

      <p className="text-xs text-muted-foreground">
        Current fiscal quarter:{" "}
        <Badge variant="secondary">{focusQ}</Badge> — colour bands: green ≥ 100% / 80% rate,
        amber 75–99% / 50–80% rate, red below.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  loading,
}: {
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div className="border border-border p-3">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-xl font-semibold mt-1 font-mono tabular-nums">
        {loading ? "—" : value}
      </div>
    </div>
  );
}
