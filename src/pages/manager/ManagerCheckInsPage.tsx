import { useEffect, useState } from "react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { useFocusRefresh } from "@/lib/use-focus-refresh";
import { useAuthStore } from "@/stores/authStore";
import { useManagerStore } from "@/stores/managerStore";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BlurFade } from "@/components/ui/magicui/blur-fade";
import { QuarterSelector } from "@/components/goals/QuarterSelector";
import { ManagerCheckInView } from "@/components/manager/ManagerCheckInView";
import { CyclePhaseBanner } from "@/components/goals/CyclePhaseBanner";
import { currentQuarter } from "@/lib/utils";
import type { Quarter } from "@/types";

type OutcomeResult = {
  status: "success" | "error";
  title: string;
  message: string;
};

export default function ManagerCheckInsPage() {
  const user = useAuthStore((s) => s.user);
  const {
    teamSheets,
    fetchTeamSheets,
    selectedEmployeeCheckIns,
    checkInsLoading,
    fetchTeamCheckIns,
    saveManagerComment,
  } = useManagerStore();

  const [quarter, setQuarter] = useState<Quarter>(currentQuarter());
  const [employeeId, setEmployeeId] = useState<string>("");
  const [result, setResult] = useState<OutcomeResult | null>(null);

  useEffect(() => {
    if (user) void fetchTeamSheets(user.id);
  }, [user, fetchTeamSheets]);

  useFocusRefresh(() => {
    if (user) void fetchTeamSheets(user.id);
    if (employeeId) void fetchTeamCheckIns(employeeId, quarter);
  });

  // Deduplicate employees from teamSheets (one entry per employee).
  const employees = (() => {
    const seen = new Set<string>();
    const out: { id: string; name: string; hasApproved: boolean }[] = [];
    for (const s of teamSheets) {
      if (seen.has(s.employee_id)) continue;
      seen.add(s.employee_id);
      out.push({
        id: s.employee_id,
        name: s.employee.full_name || s.employee.email,
        hasApproved: teamSheets.some(
          (t) => t.employee_id === s.employee_id && t.status === "APPROVED",
        ),
      });
    }
    return out;
  })();

  // Auto-select the first employee with an APPROVED sheet on first load
  useEffect(() => {
    if (employeeId) return;
    const firstApproved = employees.find((e) => e.hasApproved);
    if (firstApproved) setEmployeeId(firstApproved.id);
  }, [employees, employeeId]);

  useEffect(() => {
    if (employeeId) void fetchTeamCheckIns(employeeId, quarter);
  }, [employeeId, quarter, fetchTeamCheckIns]);

  if (!user) return null;

  const selectedEmployee = employees.find((e) => e.id === employeeId);
  const noEmployees = employees.length === 0;

  // Wrap the store's saveManagerComment so the outcome lives at the page
  // level — one Lottie surface for every per-row save, mirroring the
  // employee CheckIns page and the round-7 design rule.
  const handleSaveComment = async (checkInId: string, comment: string) => {
    const { error } = await saveManagerComment(checkInId, comment);
    if (error) {
      setResult({
        status: "error",
        title: "Could not save comment",
        message: error,
      });
    } else {
      setResult({
        status: "success",
        title: comment.trim() ? "Comment saved" : "Comment cleared",
        message: "Your feedback is now visible to the employee for this quarter.",
      });
    }
    return { error };
  };

  return (
    <div className="space-y-5 max-w-6xl">
      <BlurFade>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">
              Team Check-ins
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Review your team's quarterly progress and add structured feedback.
            </p>
          </div>
          <QuarterSelector activeQuarter={quarter} onQuarterChange={setQuarter} />
        </div>
      </BlurFade>

      <BlurFade delay={0.04}>
        <CyclePhaseBanner />
      </BlurFade>

      <BlurFade delay={0.08}>
        <Card className="rounded-md border-border/60 bg-card">
          <CardHeader>
            <CardTitle className="text-base">Select team member</CardTitle>
            <CardDescription>
              Only employees with an approved goal sheet can be reviewed for check-ins.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-sm space-y-1">
              <Label htmlFor="employee">Employee</Label>
              {noEmployees ? (
                // No direct reports yet — render a disabled dropdown that
                // explicitly says "No employees available" inside the trigger,
                // per user direction. Reads as "intentionally empty" rather
                // than a missing/broken control.
                <Select disabled value="">
                  <SelectTrigger id="employee">
                    <SelectValue placeholder="No employees available" />
                  </SelectTrigger>
                  <SelectContent />
                </Select>
              ) : (
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger id="employee">
                    <SelectValue placeholder="Choose an employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id} disabled={!e.hasApproved}>
                        {e.name}
                        {!e.hasApproved && " · no approved sheet"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardContent>
        </Card>
      </BlurFade>

      {employeeId && (
        <BlurFade delay={0.12}>
          <Card className="rounded-md border-border/60 bg-card">
            <CardHeader>
              <CardTitle className="text-base">
                {selectedEmployee?.name} · {quarter}
              </CardTitle>
              <CardDescription>
                Planned target vs actual achievement. Click any comment cell to edit.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {checkInsLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : !selectedEmployee?.hasApproved ? (
                <p className="text-sm text-muted-foreground">
                  No approved sheet for this employee.
                </p>
              ) : (
                <ManagerCheckInView
                  rows={selectedEmployeeCheckIns}
                  quarter={quarter}
                  onSaveComment={handleSaveComment}
                />
              )}
            </CardContent>
          </Card>
        </BlurFade>
      )}

      {/* -------------------- Outcome dialog (success / error) ------------- */}
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
