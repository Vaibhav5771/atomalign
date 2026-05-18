import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BlurFade } from "@/components/ui/magicui/blur-fade";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { ExportButton } from "@/components/shared/ExportButton";
import { CompletionTable } from "@/components/admin/CompletionTable";
import { AuditTable } from "@/components/admin/AuditTable";
import { cn, currentQuarter } from "@/lib/utils";
import { useReportsStore } from "@/stores/reportsStore";
import type { SheetStatus } from "@/types";

const ALL = "__ALL__";

function scoreClass(score: number | null) {
  if (score == null) return "text-muted-foreground";
  if (score >= 100) return "text-emerald-600";
  if (score >= 75) return "text-amber-600";
  return "text-rose-600";
}

const STATUS_OPTIONS: SheetStatus[] = ["DRAFT", "SUBMITTED", "APPROVED", "RETURNED"];

export default function ReportsPage() {
  const {
    completion,
    achievement,
    audit,
    loadingCompletion,
    loadingAchievement,
    loadingAudit,
    fetchCompletion,
    fetchAchievement,
    fetchAudit,
  } = useReportsStore();

  const [tab, setTab] = useState<"export" | "completion" | "audit">("export");
  const [department, setDepartment] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);

  useEffect(() => {
    void fetchAchievement();
    void fetchCompletion();
    void fetchAudit();
  }, [fetchAchievement, fetchCompletion, fetchAudit]);

  useFocusRefresh(() => {
    void Promise.all([fetchAchievement(), fetchCompletion(), fetchAudit()]);
  });

  // -------- Achievement tab ---------------------------------------------------
  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    for (const a of achievement) if (a.department) set.add(a.department);
    return Array.from(set).sort();
  }, [achievement]);

  const filteredAchievement = useMemo(() => {
    return achievement.filter((a) => {
      if (department !== ALL && a.department !== department) return false;
      if (status !== ALL && a.sheet_status !== status) return false;
      return true;
    });
  }, [achievement, department, status]);

  // Excel rows — flatten to a clean key order
  const exportRows = useMemo(
    () =>
      filteredAchievement.map((a) => ({
        Employee: a.employee_name,
        Department: a.department ?? "",
        "Sheet Status": a.sheet_status,
        "Goal Title": a.goal_title,
        "Thrust Area": a.thrust_area,
        UoM: a.uom,
        Target: a.target,
        "Weightage %": a.weightage,
        "Q1 Actual": a.q1_actual ?? "",
        "Q2 Actual": a.q2_actual ?? "",
        "Q3 Actual": a.q3_actual ?? "",
        "Q4 Actual": a.q4_actual ?? "",
        "Score %": a.score == null ? "" : Number(a.score.toFixed(1)),
      })),
    [filteredAchievement],
  );

  // -------- Completion tab ----------------------------------------------------
  const focusQ = currentQuarter();
  const completionStats = useMemo(() => {
    const total = completion.length;
    const completed = completion.filter((c) => c.quarters[focusQ] === "COMPLETED").length;
    return { total, completed, pending: total - completed };
  }, [completion, focusQ]);

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Achievement export, completion dashboard, and audit trail — for HR governance.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "export" | "completion" | "audit")}
      >
        <TabsList>
          <TabsTrigger value="export">Achievement Export</TabsTrigger>
          <TabsTrigger value="completion">Completion Dashboard</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        {/* ============ Tab 1 — Achievement Export ============================ */}
        <TabsContent value="export" className="space-y-3">
          <BlurFade>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Achievement Export</CardTitle>
              <CardDescription>
                Per-goal actuals across all quarters. Download the current filtered view as an
                Excel workbook.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-end justify-between gap-3 flex-wrap">
                <div className="flex gap-3 flex-wrap">
                  <div className="min-w-[12rem] space-y-1">
                    <Label htmlFor="dept_filter" className="text-xs">
                      Department
                    </Label>
                    <Select value={department} onValueChange={setDepartment}>
                      <SelectTrigger id="dept_filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All departments</SelectItem>
                        {departmentOptions.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-[12rem] space-y-1">
                    <Label htmlFor="status_filter" className="text-xs">
                      Sheet status
                    </Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger id="status_filter">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>All statuses</SelectItem>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <ExportButton
                  data={exportRows}
                  filename="achievement-report"
                  label="Export to Excel"
                  sheetName="Achievement"
                  disabled={loadingAchievement}
                />
              </div>

              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Goal Title</TableHead>
                        <TableHead>Thrust Area</TableHead>
                        <TableHead className="w-20">UoM</TableHead>
                        <TableHead className="w-24">Target</TableHead>
                        <TableHead className="w-20 text-right">Q1</TableHead>
                        <TableHead className="w-20 text-right">Q2</TableHead>
                        <TableHead className="w-20 text-right">Q3</TableHead>
                        <TableHead className="w-20 text-right">Q4</TableHead>
                        <TableHead className="w-24 text-right">Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingAchievement ? (
                        <TableRow>
                          <TableCell
                            colSpan={11}
                            className="text-center text-sm text-muted-foreground py-6"
                          >
                            Loading…
                          </TableCell>
                        </TableRow>
                      ) : filteredAchievement.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={11}
                            className="text-center text-sm text-muted-foreground py-6"
                          >
                            No rows match these filters.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAchievement.map((a) => (
                          <TableRow key={a.goal_id}>
                            <TableCell className="font-medium">{a.employee_name}</TableCell>
                            <TableCell className="text-sm">{a.department ?? "—"}</TableCell>
                            <TableCell className="text-sm">{a.goal_title}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {a.thrust_area}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{a.uom}</Badge>
                            </TableCell>
                            <TableCell className="text-sm tabular-nums">{a.target}</TableCell>
                            <TableCell className="text-sm tabular-nums text-right">
                              {a.q1_actual ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm tabular-nums text-right">
                              {a.q2_actual ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm tabular-nums text-right">
                              {a.q3_actual ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm tabular-nums text-right">
                              {a.q4_actual ?? "—"}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right font-semibold tabular-nums",
                                scoreClass(a.score),
                              )}
                            >
                              {a.score == null ? "—" : `${a.score.toFixed(1)}%`}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
          </BlurFade>
        </TabsContent>

        {/* ============ Tab 2 — Completion Dashboard ========================== */}
        <TabsContent value="completion" className="space-y-3">
          <BlurFade>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Completion Dashboard</CardTitle>
              <CardDescription>
                Per-employee, per-quarter status of check-in completion. Only APPROVED sheets
                are tracked.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 max-w-2xl">
                <Stat label="Employees" value={completionStats.total} loading={loadingCompletion} />
                <Stat
                  label={`Completed ${focusQ}`}
                  value={completionStats.completed}
                  loading={loadingCompletion}
                />
                <Stat
                  label={`Pending ${focusQ}`}
                  value={completionStats.pending}
                  loading={loadingCompletion}
                />
              </div>
              <CompletionTable rows={completion} loading={loadingCompletion} />
            </CardContent>
          </Card>
          </BlurFade>
        </TabsContent>

        {/* ============ Tab 3 — Audit Trail =================================== */}
        <TabsContent value="audit" className="space-y-3">
          <BlurFade>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Audit Trail</CardTitle>
              <CardDescription>
                Every recorded change, newest first. Click any row to expand its old / new JSON.
                Capped at 500 most recent entries.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AuditTable rows={audit} loading={loadingAudit} />
            </CardContent>
          </Card>
          </BlurFade>
        </TabsContent>
      </Tabs>
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
