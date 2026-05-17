import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useManagerStore } from "@/stores/managerStore";
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
import { QuarterSelector } from "@/components/goals/QuarterSelector";
import { ManagerCheckInView } from "@/components/manager/ManagerCheckInView";
import { CyclePhaseBanner } from "@/components/goals/CyclePhaseBanner";
import { currentQuarter } from "@/lib/utils";
import type { Quarter } from "@/types";

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

  useEffect(() => {
    if (user) void fetchTeamSheets(user.id);
  }, [user, fetchTeamSheets]);

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

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Team Check-ins</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review your team's quarterly progress and add structured feedback.
          </p>
        </div>
        <QuarterSelector activeQuarter={quarter} onQuarterChange={setQuarter} />
      </div>

      <CyclePhaseBanner />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select team member</CardTitle>
          <CardDescription>
            Only employees with an approved goal sheet can be reviewed for check-ins.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <p className="text-sm text-muted-foreground">No direct reports.</p>
          ) : (
            <div className="max-w-sm space-y-1">
              <Label htmlFor="employee">Employee</Label>
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
            </div>
          )}
        </CardContent>
      </Card>

      {employeeId && (
        <Card>
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
                onSaveComment={saveManagerComment}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
