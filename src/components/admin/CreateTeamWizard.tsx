import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { notify } from "@/lib/notify";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Profile } from "@/types";

interface CreateTeamWizardProps {
  showProfileStep?: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Step = "profile" | "managers" | "employees" | "summary";

const MAX_MANAGERS = 5;
const MAX_EMPLOYEES = 20;

interface BaseRow {
  full_name: string;
  email: string;
  password: string;
  department: string;
  error?: string;
}

type ManagerRow = BaseRow;

interface EmployeeRow extends BaseRow {
  manager_id: string;
}

interface CreatedUser {
  id: string;
  full_name: string;
  email: string;
  password: string;
  role: "MANAGER" | "EMPLOYEE";
  reports_to_email?: string;
}

const blankManager = (): ManagerRow => ({
  full_name: "",
  email: "",
  password: "",
  department: "",
});

const blankEmployee = (defaultManagerId = ""): EmployeeRow => ({
  ...blankManager(),
  manager_id: defaultManagerId,
});

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function collectDuplicateEmails(emails: string[]): Set<string> {
  const seen = new Map<string, number>();
  for (const raw of emails) {
    const e = raw.trim().toLowerCase();
    if (!e) continue;
    seen.set(e, (seen.get(e) ?? 0) + 1);
  }
  const dupes = new Set<string>();
  for (const [e, n] of seen.entries()) if (n > 1) dupes.add(e);
  return dupes;
}

export function CreateTeamWizard({
  showProfileStep,
  onClose,
  onComplete,
}: CreateTeamWizardProps) {
  const { toast } = useToast();
  const me = useAuthStore((s) => s.user);
  const adminCreateUser = useAuthStore((s) => s.adminCreateUser);
  const updateMyAccount = useAuthStore((s) => s.updateMyAccount);
  const fetchWorkspaceManagers = useAuthStore((s) => s.fetchWorkspaceManagers);
  const fetchWorkspaceEmployees = useAuthStore((s) => s.fetchWorkspaceEmployees);

  const [step, setStep] = useState<Step>(
    showProfileStep ? "profile" : "managers",
  );

  // -- Step 0: profile state
  const [profileName, setProfileName] = useState(me?.full_name ?? "");
  const [profileEmail, setProfileEmail] = useState(me?.email ?? "");
  const [profilePassword, setProfilePassword] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);

  // -- Step 1: managers state
  const [managers, setManagers] = useState<ManagerRow[]>([blankManager()]);
  const [managersWorking, setManagersWorking] = useState(false);
  const [managerProgress, setManagerProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  // -- Step 2: employees state
  const [employees, setEmployees] = useState<EmployeeRow[]>([blankEmployee()]);
  const [employeesWorking, setEmployeesWorking] = useState(false);
  const [employeeProgress, setEmployeeProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [allManagers, setAllManagers] = useState<Profile[]>([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [managersError, setManagersError] = useState<string | null>(null);
  const [allEmployees, setAllEmployees] = useState<Profile[]>([]);

  // -- Summary state
  const [created, setCreated] = useState<CreatedUser[]>([]);

  const summaryTree = useMemo(() => {
    type SummaryEmployee = {
      id: string;
      full_name: string;
      email: string;
      password?: string;
      isNew: boolean;
    };

    const managerNodes = new Map<
      string,
      {
        mgrName: string;
        mgrEmail: string;
        mgrRole: string;
        mgrPassword?: string;
        isNew: boolean;
        employees: SummaryEmployee[];
      }
    >();

    // 1. Initialize all existing managers
    allManagers.forEach((m) => {
      managerNodes.set(m.email, {
        mgrName: m.full_name || m.email,
        mgrEmail: m.email,
        mgrRole: m.role || "MANAGER",
        isNew: false,
        employees: [],
      });
    });

    // 2. Mark newly created managers and attach passwords
    created
      .filter((u) => u.role === "MANAGER")
      .forEach((c) => {
        if (managerNodes.has(c.email)) {
          const node = managerNodes.get(c.email)!;
          node.isNew = true;
          node.mgrPassword = c.password;
        }
      });

    // 3. Attach all employees to their managers
    allEmployees.forEach((e) => {
      const mgr = allManagers.find((mx) => mx.id === e.manager_id);
      const mgrEmail = mgr?.email;
      if (!mgrEmail || !managerNodes.has(mgrEmail)) return;

      const createdE = created.find((c) => c.email === e.email && c.role === "EMPLOYEE");
      managerNodes.get(mgrEmail)!.employees.push({
        id: e.id,
        full_name: e.full_name || e.email,
        email: e.email,
        password: createdE?.password,
        isNew: !!createdE,
      });
    });

    return Array.from(managerNodes.values());
  }, [created, allManagers, allEmployees]);

  const uniqueManagerDepartments = useMemo(() => {
    const deps = allManagers
      .map((m) => m.department?.trim())
      .filter(Boolean) as string[];
    return Array.from(new Set(deps));
  }, [allManagers]);

  // Load all managers when entering managers or employees step
  useEffect(() => {
    if (step !== "employees" && step !== "managers") return;
    void (async () => {
      setManagersLoading(true);
      setManagersError(null);
      try {
        const list = await fetchWorkspaceManagers();
        setAllManagers(list);

        if (step === "employees") {
          const empList = await fetchWorkspaceEmployees();
          setAllEmployees(empList);
        }

        const defaultMgr = list[0]?.id ?? "";
        setEmployees((rows) =>
          rows.map((r) => ({
            ...r,
            manager_id: r.manager_id || defaultMgr,
          })),
        );
      } catch (err: any) {
        setManagersError(err.message || String(err));
      } finally {
        setManagersLoading(false);
      }
    })();
  }, [step, fetchWorkspaceManagers, fetchWorkspaceEmployees]);

  // -------------------------------------------------------------------------
  // Step 0 handlers
  // -------------------------------------------------------------------------
  const onSaveProfile = async () => {
    setProfileError(null);
    if (!profileName.trim()) {
      setProfileError("Full name is required");
      return;
    }
    if (!isValidEmail(profileEmail)) {
      setProfileError("Enter a valid email");
      return;
    }
    if (profilePassword && profilePassword.length < 6) {
      setProfileError("Password must be at least 6 characters");
      return;
    }
    setProfileSaving(true);
    const { error } = await updateMyAccount({
      full_name: profileName.trim(),
      email: profileEmail.trim() !== me?.email ? profileEmail.trim() : undefined,
      password: profilePassword || undefined,
    });
    setProfileSaving(false);
    if (error) {
      setProfileError(error);
      return;
    }
    toast({ title: "Admin profile updated" });
    setStep("managers");
  };

  // -------------------------------------------------------------------------
  // Step 1 handlers (managers)
  // -------------------------------------------------------------------------
  const setManagerField = (
    idx: number,
    field: keyof ManagerRow,
    value: string,
  ) => {
    setManagers((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, [field]: value, error: undefined } : r)),
    );
  };

  const validateManagerRows = (rows: ManagerRow[]): boolean => {
    const allEmails = rows.map((r) => r.email);
    const dupes = collectDuplicateEmails(allEmails);
    let ok = true;
    const next = rows.map((r) => {
      const email = r.email.trim();
      if (!r.full_name.trim()) {
        ok = false;
        return { ...r, error: "Full name is required" };
      }
      if (!isValidEmail(email)) {
        ok = false;
        return { ...r, error: "Enter a valid email" };
      }
      if (dupes.has(email.toLowerCase())) {
        ok = false;
        return { ...r, error: "Duplicate email in this form" };
      }
      if (!r.password || r.password.length < 6) {
        ok = false;
        return { ...r, error: "Password must be at least 6 characters" };
      }
      return { ...r, error: undefined };
    });
    setManagers(next);
    return ok;
  };

  const onCreateManagers = async () => {
    if (!validateManagerRows(managers)) return;
    setManagersWorking(true);
    setManagerProgress({ done: 0, total: managers.length });

    const results = await Promise.all(
      managers.map(async (row) => {
        const { error, userId } = await adminCreateUser({
          email: row.email.trim(),
          password: row.password,
          full_name: row.full_name.trim(),
          role: "MANAGER",
          department: row.department.trim() || null,
        });
        return { row, error, userId };
      }),
    );

    const newlyCreated: CreatedUser[] = [];
    const next = managers.map((row, i) => {
      const { error, userId } = results[i];
      if (error || !userId) return { ...row, error: error ?? "Unknown error" };
      newlyCreated.push({
        id: userId,
        full_name: row.full_name.trim(),
        email: row.email.trim(),
        password: row.password,
        role: "MANAGER",
      });
      if (me?.id) {
        notify({
          event: "user_created",
          actorId: me.id,
          recipientId: userId,
          password: row.password,
        });
      }
      return { ...row, error: undefined };
    });

    setManagers(next);
    setManagerProgress(null);
    setManagersWorking(false);

    const failedCount = next.filter((r) => r.error).length;
    if (failedCount > 0 && newlyCreated.length === 0) {
      toast({
        title: "No managers were created",
        description: "Check the row errors and try again.",
        variant: "destructive",
      });
      return;
    }
    if (failedCount > 0) {
      toast({
        title: `${newlyCreated.length} managers created, ${failedCount} failed`,
        description: "Failed rows are still visible. Fix and retry, or skip ahead.",
      });
    } else {
      toast({ title: `${newlyCreated.length} managers created` });
    }

    setCreated((existing) => [...existing, ...newlyCreated]);
    await fetchWorkspaceManagers(true);
    setStep("employees");
  };

  // -------------------------------------------------------------------------
  // Step 2 handlers (employees)
  // -------------------------------------------------------------------------
  const setEmployeeField = (
    idx: number,
    field: keyof EmployeeRow,
    value: string,
  ) => {
    setEmployees((rows) =>
      rows.map((r, i) =>
        i === idx ? { ...r, [field]: value, error: undefined } : r,
      ),
    );
  };

  const validateEmployeeRows = (rows: EmployeeRow[]): boolean => {
    const allEmails = [
      ...rows.map((r) => r.email),
      ...managers.map((m) => m.email), // disallow re-using a manager email
    ];
    const dupes = collectDuplicateEmails(allEmails);
    let ok = true;
    const next = rows.map((r) => {
      const email = r.email.trim();
      if (!r.full_name.trim()) {
        ok = false;
        return { ...r, error: "Full name is required" };
      }
      if (!isValidEmail(email)) {
        ok = false;
        return { ...r, error: "Enter a valid email" };
      }
      if (dupes.has(email.toLowerCase())) {
        ok = false;
        return { ...r, error: "Duplicate email" };
      }
      if (!r.password || r.password.length < 6) {
        ok = false;
        return { ...r, error: "Password must be at least 6 characters" };
      }
      if (!r.manager_id) {
        ok = false;
        return { ...r, error: "Pick a reporting manager" };
      }
      return { ...r, error: undefined };
    });
    setEmployees(next);
    return ok;
  };

  const onCreateEmployees = async () => {
    if (!validateEmployeeRows(employees)) return;
    setEmployeesWorking(true);
    setEmployeeProgress({ done: 0, total: employees.length });

    const managerEmailById = new Map<string, string>();
    for (const m of allManagers) managerEmailById.set(m.id, m.email);

    const results = await Promise.all(
      employees.map(async (row) => {
        const { error, userId } = await adminCreateUser({
          email: row.email.trim(),
          password: row.password,
          full_name: row.full_name.trim(),
          role: "EMPLOYEE",
          manager_id: row.manager_id,
          department: row.department.trim() || null,
        });
        return { row, error, userId };
      }),
    );

    const newlyCreated: CreatedUser[] = [];
    const next = employees.map((row, i) => {
      const { error, userId } = results[i];
      if (error || !userId) return { ...row, error: error ?? "Unknown error" };
      newlyCreated.push({
        id: userId,
        full_name: row.full_name.trim(),
        email: row.email.trim(),
        password: row.password,
        role: "EMPLOYEE",
        reports_to_email: managerEmailById.get(row.manager_id),
      });
      if (me?.id) {
        notify({
          event: "user_created",
          actorId: me.id,
          recipientId: userId,
          password: row.password,
        });
      }
      return { ...row, error: undefined };
    });

    setEmployees(next);
    setEmployeeProgress(null);
    setEmployeesWorking(false);

    const failedCount = next.filter((r) => r.error).length;
    if (failedCount > 0 && newlyCreated.length === 0) {
      toast({
        title: "No employees were created",
        description: "Check the row errors and try again.",
        variant: "destructive",
      });
      return;
    }
    if (failedCount > 0) {
      toast({
        title: `${newlyCreated.length} employees created, ${failedCount} failed`,
      });
    } else {
      toast({ title: `${newlyCreated.length} employees created` });
    }

    setCreated((existing) => [...existing, ...newlyCreated]);
    await fetchWorkspaceEmployees(true);
    setStep("summary");
  };

  // -------------------------------------------------------------------------
  // Summary handlers
  // -------------------------------------------------------------------------
  const onCopyAll = async () => {
    const lines = [
      "| Name | Email | Password | Role | Reports to |",
      "|------|-------|----------|------|------------|",
      ...created.map(
        (u) =>
          `| ${u.full_name} | ${u.email} | ${u.password} | ${u.role} | ${
            u.reports_to_email ?? "—"
          } |`,
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({
        title: "Could not copy",
        description: "Select the table and copy manually.",
        variant: "destructive",
      });
    }
  };

  const onDone = () => {
    onComplete();
    onClose();
  };

  const onAnotherTeam = () => {
    setManagers([blankManager()]);
    setEmployees([blankEmployee()]);
    setManagerProgress(null);
    setEmployeeProgress(null);
    setStep("managers");
    // Keep `created` so the summary stays cumulative if user toggles back
  };

  // -------------------------------------------------------------------------
  // Step renderers
  // -------------------------------------------------------------------------

  const stepIndex = useMemo(() => {
    const order: Step[] = showProfileStep
      ? ["profile", "managers", "employees", "summary"]
      : ["managers", "employees", "summary"];
    return order.indexOf(step) + 1;
  }, [step, showProfileStep]);

  const stepTotal = showProfileStep ? 4 : 3;

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {step === "profile" && "Set up your admin account"}
          {step === "managers" && "Add managers"}
          {step === "employees" && "Add employees"}
          {step === "summary" && "Team created"}
        </DialogTitle>
        <DialogDescription>
          {step !== "summary" ? (
            <span>
              Step {stepIndex} of {stepTotal}
              {" — "}
              {step === "profile" &&
                "So you also receive goal-event notifications."}
              {step === "managers" &&
                "Use real emails — your team will receive notifications for goal submissions, approvals, and check-ins."}
              {step === "employees" &&
                "Each employee reports to one of the managers above (or any existing manager)."}
            </span>
          ) : (
            <span>
              Welcome emails are on their way. Use these credentials to sign in
              as any of the new users.
            </span>
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
        {step === "profile" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="adm_full_name">Full name *</Label>
              <Input
                id="adm_full_name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                disabled={profileSaving}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adm_email">Email *</Label>
              <Input
                id="adm_email"
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                disabled={profileSaving}
              />
              <p className="text-xs text-muted-foreground">
                Email change is immediate (Confirm-email is disabled on the demo
                project).
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="adm_password">New password (optional)</Label>
              <Input
                id="adm_password"
                type="text"
                value={profilePassword}
                onChange={(e) => setProfilePassword(e.target.value)}
                placeholder="Leave blank to keep current password"
                disabled={profileSaving}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                Your existing session stays signed in. New password applies on
                next sign-in.
              </p>
            </div>
            {profileError && (
              <p className="text-sm text-destructive">{profileError}</p>
            )}
          </div>
        )}

        {step === "managers" && (
          <div className="space-y-4">
            {allManagers.length > 0 && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4">
                <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
                  Existing Managers ({allManagers.length})
                </h4>
                <div className="space-y-1">
                  {allManagers.map((m) => (
                    <div key={m.id} className="text-sm flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                      <span>{m.full_name || m.email}</span>
                      {m.department && <Badge variant="outline" className="bg-emerald-500/5">{m.department}</Badge>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              {managers.map((row, idx) => (
              <div
                key={idx}
                className="border border-border rounded-md p-3 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    Manager {idx + 1}
                  </div>
                  {managers.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setManagers((rows) => rows.filter((_, i) => i !== idx))
                      }
                      disabled={managersWorking}
                      aria-label={`Remove manager ${idx + 1}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Full name *</Label>
                    <Input
                      value={row.full_name}
                      onChange={(e) =>
                        setManagerField(idx, "full_name", e.target.value)
                      }
                      disabled={managersWorking}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      value={row.email}
                      onChange={(e) =>
                        setManagerField(idx, "email", e.target.value)
                      }
                      disabled={managersWorking}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Password *</Label>
                    <Input
                      type="text"
                      value={row.password}
                      onChange={(e) =>
                        setManagerField(idx, "password", e.target.value)
                      }
                      placeholder="Min 6 characters"
                      disabled={managersWorking}
                      autoComplete="off"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Department</Label>
                    <Input
                      value={row.department}
                      onChange={(e) =>
                        setManagerField(idx, "department", e.target.value)
                      }
                      placeholder="optional"
                      disabled={managersWorking}
                    />
                  </div>
                </div>
                {row.error && (
                  <p className="text-xs text-destructive">{row.error}</p>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setManagers((rows) => [...rows, blankManager()])
              }
              disabled={managers.length >= MAX_MANAGERS || managersWorking}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add manager
              <span className="ml-2 text-xs text-muted-foreground">
                {managers.length}/{MAX_MANAGERS}
              </span>
            </Button>
            </div>
          </div>
        )}

        {step === "employees" && (
          <div className="space-y-4">
            {allEmployees.length > 0 && !managersLoading && (
              <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4">
                <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
                  Existing Employees ({allEmployees.length})
                </h4>
                <div className="space-y-1">
                  {allEmployees.map((e) => {
                    const mgr = allManagers.find(m => m.id === e.manager_id);
                    return (
                      <div key={e.id} className="text-sm flex flex-col sm:flex-row sm:items-center justify-between text-emerald-700 dark:text-emerald-400 py-1.5 border-b border-emerald-500/10 last:border-0">
                        <span className="font-medium">{e.full_name || e.email}</span>
                        {mgr && <span className="text-xs opacity-80 sm:ml-2">Reports to: {mgr.full_name || mgr.email}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              {managersLoading ? (
                <div className="flex items-center justify-center p-8 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-sm">Loading managers...</span>
              </div>
            ) : managersError ? (
              <div className="text-sm text-destructive p-4 border border-destructive/20 rounded-md bg-destructive/10">
                Failed to load managers: {managersError}
              </div>
            ) : allManagers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No managers available. Go back to Step 1 and create at least
                one manager first.
              </p>
            ) : (
              <>
                {employees.map((row, idx) => (
                  <div
                    key={idx}
                    className="border border-border rounded-md p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">
                        Employee {idx + 1}
                      </div>
                      {employees.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            setEmployees((rows) =>
                              rows.filter((_, i) => i !== idx),
                            )
                          }
                          disabled={employeesWorking}
                          aria-label={`Remove employee ${idx + 1}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Full name *</Label>
                        <Input
                          value={row.full_name}
                          onChange={(e) =>
                            setEmployeeField(idx, "full_name", e.target.value)
                          }
                          disabled={employeesWorking}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Email *</Label>
                        <Input
                          type="email"
                          value={row.email}
                          onChange={(e) =>
                            setEmployeeField(idx, "email", e.target.value)
                          }
                          disabled={employeesWorking}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Password *</Label>
                        <Input
                          type="text"
                          value={row.password}
                          onChange={(e) =>
                            setEmployeeField(idx, "password", e.target.value)
                          }
                          placeholder="Min 6 characters"
                          disabled={employeesWorking}
                          autoComplete="off"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Department</Label>
                        {uniqueManagerDepartments.length > 0 ? (
                          <Select
                            value={row.department || "_none"}
                            onValueChange={(v) => {
                              setEmployeeField(idx, "department", v === "_none" ? "" : v);
                              setEmployeeField(idx, "manager_id", "");
                            }}
                            disabled={employeesWorking}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Any department" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="_none">None / Any</SelectItem>
                              {uniqueManagerDepartments.map((d) => (
                                <SelectItem key={d} value={d}>
                                  {d}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={row.department}
                            onChange={(e) =>
                              setEmployeeField(idx, "department", e.target.value)
                            }
                            placeholder="optional"
                            disabled={employeesWorking}
                          />
                        )}
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label>Reports to *</Label>
                        <Select
                          value={row.manager_id}
                          onValueChange={(v) =>
                            setEmployeeField(idx, "manager_id", v)
                          }
                          disabled={employeesWorking}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pick a manager" />
                          </SelectTrigger>
                          <SelectContent>
                            {allManagers
                              .filter((m) => !row.department || m.department === row.department)
                              .map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.full_name || m.email} {m.department ? `(${m.department})` : ""}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {row.error && (
                      <p className="text-xs text-destructive">{row.error}</p>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setEmployees((rows) => [
                      ...rows,
                      blankEmployee(allManagers[0]?.id ?? ""),
                    ])
                  }
                  disabled={
                    employees.length >= MAX_EMPLOYEES || employeesWorking
                  }
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add employee
                  <span className="ml-2 text-xs text-muted-foreground">
                    {employees.length}/{MAX_EMPLOYEES}
                  </span>
                </Button>
              </>
            )}
            </div>
          </div>
        )}

        {step === "summary" && (
          <div className="space-y-4">
            {created.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 py-3 px-4 rounded-md border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                Successfully created {created.length} {created.length === 1 ? "user" : "users"}.
              </div>
            )}
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <h3 className="font-semibold text-lg text-foreground px-1">Complete Team Hierarchy</h3>
              {summaryTree.map((node, i) => (
                <div key={i} className="border border-border rounded-md overflow-hidden bg-muted/20">
                  <div className="bg-muted/50 p-3 flex flex-col sm:flex-row sm:items-center justify-between border-b border-border gap-2">
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {node.mgrName}
                        {node.isNew ? (
                          <Badge variant="secondary" className="text-[10px] h-4 py-0 leading-none">New</Badge>
                        ) : null}
                      </div>
                      <div className="text-xs font-mono text-muted-foreground mt-0.5">{node.mgrEmail}</div>
                    </div>
                    {node.isNew && node.mgrPassword && (
                      <div className="text-xs font-mono font-medium bg-background border border-border px-2 py-1 rounded w-max">
                        <span className="text-muted-foreground mr-1">Password:</span>
                        {node.mgrPassword}
                      </div>
                    )}
                  </div>
                  
                  {node.employees.length > 0 ? (
                    <div className="p-3 space-y-2">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Direct Reports ({node.employees.length})</div>
                      <div className="grid gap-2">
                        {node.employees.map(e => (
                          <div key={e.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-md border border-border bg-background shadow-sm">
                            <div>
                              <div className="text-sm font-medium flex items-center gap-2">
                                {e.full_name}
                                {e.isNew && <Badge variant="secondary" className="text-[10px] h-4 py-0 leading-none">New</Badge>}
                              </div>
                              <div className="text-xs font-mono text-muted-foreground mt-0.5">{e.email}</div>
                            </div>
                            {e.isNew && e.password && (
                              <div className="mt-2 sm:mt-0 text-xs font-mono bg-muted border border-border px-2 py-1 rounded text-foreground">
                                <span className="text-muted-foreground mr-1">pw:</span>
                                {e.password}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 text-xs flex text-muted-foreground italic">
                      No direct reports assigned.
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        {step === "profile" && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("managers")}
              disabled={profileSaving}
            >
              Skip — keep current account
            </Button>
            <Button type="button" onClick={onSaveProfile} disabled={profileSaving}>
              {profileSaving && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              Save &amp; continue
            </Button>
          </>
        )}

        {step === "managers" && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("employees")}
              disabled={managersWorking}
            >
              Skip — I already have managers
            </Button>
            <Button
              type="button"
              onClick={onCreateManagers}
              disabled={managersWorking}
            >
              {managersWorking && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              {managersWorking && managerProgress
                ? `Creating ${managerProgress.done + 1} of ${managerProgress.total}…`
                : "Continue → add employees"}
            </Button>
          </>
        )}

        {step === "employees" && (
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep("managers")}
              disabled={employeesWorking}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Button
              type="button"
              onClick={onCreateEmployees}
              disabled={employeesWorking || allManagers.length === 0}
            >
              {employeesWorking && (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              )}
              {employeesWorking && employeeProgress
                ? `Creating ${employeeProgress.done + 1} of ${employeeProgress.total}…`
                : "Create team"}
            </Button>
          </>
        )}

        {step === "summary" && (
          <>
            <Button type="button" variant="outline" onClick={onCopyAll}>
              <Copy className="h-4 w-4 mr-1" />
              Copy all credentials
            </Button>
            <Button type="button" variant="outline" onClick={onAnotherTeam}>
              Create another team
            </Button>
            <Button type="button" onClick={onDone}>
              Done
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  );
}
