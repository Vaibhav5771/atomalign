import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import * as XLSX from "xlsx";
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

function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

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

  // Export confirm + outcome flow — mirrors UsersPage / SharedGoalsPage.
  // Local validation snapshot in the confirm dialog, then a Lottie-driven
  // outcome dialog after the download attempt (success.lottie / error.lottie).
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<{
    status: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

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

  const exportFilename = `achievement-report-${todayStamp()}.xlsx`;

  // Step 1 — admin clicked "Export to Excel". Open the confirm dialog with a
  // snapshot of what will be downloaded. No file is written yet.
  const handleExportClick = () => {
    if (loadingAchievement) return;
    if (exportRows.length === 0) {
      setResult({
        status: "error",
        title: "Nothing to export",
        message: "The current filtered view has no rows. Adjust the filters and try again.",
      });
      return;
    }
    setConfirmOpen(true);
  };

  // Step 2 — admin confirmed. Build the workbook and trigger the download.
  const executeExport = async () => {
    setExporting(true);
    try {
      // Yield so the spinner paints before SheetJS blocks the main thread.
      await new Promise((r) => setTimeout(r, 0));
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Achievement");
      XLSX.writeFile(wb, exportFilename);
      setConfirmOpen(false);
      setResult({
        status: "success",
        title: "Export complete",
        message: `${exportRows.length} row${exportRows.length === 1 ? "" : "s"} downloaded as ${exportFilename}.`,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setConfirmOpen(false);
      setResult({
        status: "error",
        title: "Export failed",
        message,
      });
    } finally {
      setExporting(false);
    }
  };

  // -------- Completion tab ----------------------------------------------------
  const focusQ = currentQuarter();
  const completionStats = useMemo(() => {
    const total = completion.length;
    const completed = completion.filter((c) => c.quarters[focusQ] === "COMPLETED").length;
    return { total, completed, pending: total - completed };
  }, [completion, focusQ]);

  const departmentLabel = department === ALL ? "All departments" : department;
  const statusLabel = status === ALL ? "All statuses" : status;

  return (
    <div className="space-y-5 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight leading-tight">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Achievement export, completion dashboard, and audit trail — for HR governance.
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "export" | "completion" | "audit")}
      >
        <TabsList className="rounded-sm">
          <TabsTrigger value="export" className="rounded-sm">
            Achievement Export
          </TabsTrigger>
          <TabsTrigger value="completion" className="rounded-sm">
            Completion Dashboard
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-sm">
            Audit Trail
          </TabsTrigger>
        </TabsList>

        {/* ============ Tab 1 — Achievement Export ============================ */}
        <TabsContent value="export" className="space-y-3">
          <BlurFade>
          <Card className="rounded-md border-border/60 bg-card">
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
                <Button
                  type="button"
                  onClick={handleExportClick}
                  disabled={loadingAchievement || exporting}
                  className="rounded-sm"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export to Excel
                </Button>
              </div>

              <div className="rounded-md border border-border/60 bg-card overflow-hidden">
                <div className="overflow-x-auto scrollbar-hide">
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
          <Card className="rounded-md border-border/60 bg-card">
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
          <Card className="rounded-md border-border/60 bg-card">
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

      {/* -------------------- Confirm export dialog ------------------------- */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => {
          if (!exporting) setConfirmOpen(o);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden rounded-md border border-border/60 bg-card p-5 text-foreground shadow-2xl shadow-black/40 sm:max-w-lg"
        >
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Download this report?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              An Excel workbook will be generated from the current filtered view and saved to
              your downloads folder.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-3 max-h-[50vh] overflow-y-auto scrollbar-hide pr-1">
            <div className="rounded-md border border-border/60 bg-card p-3 space-y-2.5">
              <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                Export snapshot
              </div>
              <div>
                <div className="text-sm font-semibold leading-tight">
                  Achievement workbook
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate" title={exportFilename}>
                  {exportFilename}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                <SummaryStat label="Rows" value={String(exportRows.length)} />
                <SummaryStat label="Department" value={departmentLabel} />
                <SummaryStat label="Sheet status" value={statusLabel} />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-2 sm:justify-center">
            <Button
              variant="ghost"
              className="rounded-sm"
              disabled={exporting}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-sm"
              disabled={exporting}
              onClick={() => void executeExport()}
            >
              {exporting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {exporting ? "Exporting…" : "Yes, download"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------- Outcome dialog (success / error) -------------- */}
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
    <div className="rounded-md border border-border/60 bg-card p-3">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="text-xl font-semibold mt-1 font-mono tabular-nums">
        {loading ? "—" : value}
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-card px-2.5 py-1.5">
      <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-xs font-medium truncate tabular-nums" title={value}>
        {value}
      </div>
    </div>
  );
}
