import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Pencil, Trash2, UserPlus2 } from "lucide-react";
import { CaretDownIcon } from "@phosphor-icons/react";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { CreateTeamWizard } from "@/components/admin/CreateTeamWizard";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BlurFade } from "@/components/ui/magicui/blur-fade";
import type { Profile, UserRole } from "@/types";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Minimum 6 characters"),
  full_name: z.string().min(1, "Required"),
  // Admin role intentionally not creatable from this form — seed admins via
  // Supabase SQL or promote an existing user via the edit dialog.
  role: z.enum(["EMPLOYEE", "MANAGER"], { message: "Select a role" }),
  manager_id: z.string().optional(),
  department: z.string().trim().min(1, "Required"),
});

type FormValues = z.infer<typeof schema>;

const ROLE_LABEL: Record<UserRole, string> = {
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  ADMIN: "Admin",
};

const ROLE_BADGE: Record<UserRole, "default" | "secondary" | "outline"> = {
  ADMIN: "default",
  MANAGER: "secondary",
  EMPLOYEE: "outline",
};

export default function UsersPage() {
  const adminCreateUser = useAuthStore((s) => s.adminCreateUser);
  const currentAdminId = useAuthStore((s) => s.user?.id);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState<Profile | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  // Confirm dialog mirrors the SharedGoalsPage "Push this goal?" flow — preview
  // local form values before any Supabase round-trip.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  // Outcome dialog (spaceman.lottie on success, error.lottie on failure).
  const [result, setResult] = useState<{
    status: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      full_name: "",
      // Empty by default so the "Select Role" placeholder shows; schema
      // validation forces an explicit choice before submit.
      role: "" as "EMPLOYEE" | "MANAGER",
      manager_id: "",
      department: "",
    },
  });

  const role = watch("role");
  const managerId = watch("manager_id");
  const department = watch("department");

  const loadUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setUsers((data ?? []) as Profile[]);
    setLoadingUsers(false);
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const managers = useMemo(
    () => users.filter((u) => u.role === "MANAGER"),
    [users],
  );

  const managerById = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);

  // Distinct, non-empty department names already in the workspace. Used to
  // render Department as a dropdown when at least one exists; otherwise we
  // fall back to a free-text Input so the very first user can seed a name.
  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const u of users) {
      const d = u.department?.trim();
      if (d) set.add(d);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [users]);

  // Autofill Department from the chosen reporting manager's department when
  // the admin is creating an employee. Skips empty manager.department so we
  // never wipe what the admin typed.
  useEffect(() => {
    if (role === "MANAGER") return;
    if (!managerId) return;
    const mgrDept = managerById.get(managerId)?.department?.trim();
    if (!mgrDept) return;
    setValue("department", mgrDept, { shouldValidate: true });
  }, [managerId, role, managerById, setValue]);

  // Step 1 — validate locally, then open confirm dialog. No API call yet.
  const onSubmit = handleSubmit((values) => {
    setPendingValues(values);
    setConfirmOpen(true);
  });

  // Step 2 — admin clicked "Yes, create user" in the confirm dialog.
  const executeCreate = async () => {
    if (!pendingValues) return;
    const values = pendingValues;
    setSubmitting(true);
    const { error } = await adminCreateUser({
      email: values.email.trim(),
      password: values.password,
      full_name: values.full_name.trim(),
      role: values.role,
      manager_id: values.manager_id || null,
      department: values.department,
    });
    setSubmitting(false);
    setConfirmOpen(false);

    if (error) {
      setResult({
        status: "error",
        title: "Could not create user",
        message: error,
      });
      return;
    }

    setResult({
      status: "success",
      title: "User created",
      message: `${values.full_name} (${values.email}) can now sign in with the password you set.`,
    });
    reset({
      email: "",
      password: "",
      full_name: "",
      role: "" as "EMPLOYEE" | "MANAGER",
      manager_id: "",
      department: "",
    });
    setPendingValues(null);
    void loadUsers();
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <BlurFade>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight leading-tight">
              Users
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Create a team in one go, or add a single user using the form
              below. New users can sign in immediately with the email and
              password set here.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="rounded-sm shrink-0"
          >
            <UserPlus2 className="h-4 w-4 mr-1" />
            Create Team
          </Button>
        </div>
      </BlurFade>

      <BlurFade delay={0.05}>
      <Card className="rounded-md border-border/60 bg-card">
        <CardHeader>
          <CardTitle className="text-base">Create a new user</CardTitle>
          <CardDescription>
            The new account is created in Supabase Auth and a matching profile
            row is inserted automatically. Password must be at least 6
            characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" {...register("full_name")} placeholder="Asha Iyer" />
                {errors.full_name && (
                  <p className="text-xs text-destructive">{errors.full_name.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="off"
                  {...register("email")}
                  placeholder="asha@atomberg.com"
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="text"
                  autoComplete="off"
                  {...register("password")}
                  placeholder="At least 6 characters"
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={role}
                  onValueChange={(v) => {
                    const next = v as "EMPLOYEE" | "MANAGER";
                    setValue("role", next, { shouldValidate: true });
                    // Managers don't report to anyone in this hierarchy —
                    // clear any stale manager_id so it doesn't bleed into
                    // the confirm dialog.
                    if (next === "MANAGER") {
                      setValue("manager_id", "", { shouldValidate: true });
                    }
                  }}
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                  </SelectContent>
                </Select>
                {errors.role && (
                  <p className="text-xs text-destructive">
                    {errors.role.message}
                  </p>
                )}
              </div>
              {role !== "MANAGER" && (
                <div className="space-y-1">
                  <Label htmlFor="manager_id">Reporting manager</Label>
                  <Select
                    value={managerId ?? ""}
                    onValueChange={(v) =>
                      setValue("manager_id", v, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger id="manager_id">
                      <SelectValue placeholder="Select Manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {managers.length === 0 ? (
                        <SelectItem value="__none__" disabled>
                          No managers yet — create one first
                        </SelectItem>
                      ) : (
                        managers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.full_name || m.email}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="department">Department</Label>
                {role !== "MANAGER" && departments.length > 0 ? (
                  <Select
                    value={department || ""}
                    onValueChange={(v) =>
                      setValue("department", v, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger id="department">
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : role === "MANAGER" && departments.length > 0 ? (
                  <div className="relative">
                    <Input
                      id="department"
                      {...register("department")}
                      placeholder="Pick existing or type new"
                      className="pr-7"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        type="button"
                        aria-label="Pick from existing departments"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground outline-none focus-visible:text-foreground"
                      >
                        <CaretDownIcon className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        sideOffset={4}
                        className="min-w-[14rem] rounded-none border-0 bg-popover p-0 shadow-md ring-1 ring-foreground/10"
                      >
                        {departments.map((d) => (
                          <DropdownMenuItem
                            key={d}
                            onSelect={() =>
                              setValue("department", d, {
                                shouldValidate: true,
                              })
                            }
                            className="rounded-none py-2 pl-2 pr-8 text-xs"
                          >
                            {d}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : (
                  <Input
                    id="department"
                    {...register("department")}
                    placeholder={
                      role === "MANAGER"
                        ? "e.g. Sales, Engineering"
                        : "Select Department"
                    }
                  />
                )}
                {errors.department && (
                  <p className="text-xs text-destructive">
                    {errors.department.message}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                disabled={submitting}
                className="rounded-sm"
              >
                {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {submitting ? "Creating…" : "Create user"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      </BlurFade>

      <BlurFade delay={0.1}>
      <Card className="rounded-md border-border/60 bg-card">
        <CardHeader>
          <CardTitle className="text-base">Existing users</CardTitle>
          <CardDescription>
            {loadingUsers ? "Loading…" : `${users.length} total`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 && !loadingUsers ? (
            <p className="text-sm text-muted-foreground">No users yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const isSelf = u.id === currentAdminId;
                  // Permanent fallback admin — never editable or deletable from
                  // the UI so the demo always has a recovery login.
                  const isDemoAdmin = u.email === "admin@demo.com";
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell>
                        <Badge variant={ROLE_BADGE[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {u.manager_id
                          ? managerById.get(u.manager_id)?.full_name ?? "—"
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{u.department ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {isDemoAdmin ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setEditing(u)}
                              aria-label={`Edit ${u.full_name || u.email}`}
                              className="rounded-sm"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setDeleting(u)}
                              disabled={isSelf}
                              title={isSelf ? "You cannot delete your own account" : "Delete user"}
                              aria-label={`Delete ${u.full_name || u.email}`}
                              className="rounded-sm text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </BlurFade>

      <EditUserDialog
        user={editing}
        managers={managers}
        departments={departments}
        managerById={managerById}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void loadUsers();
        }}
      />

      <DeleteUserDialog
        user={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          void loadUsers();
        }}
      />

      <Dialog
        open={wizardOpen}
        onOpenChange={(open) => {
          if (!open) setWizardOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <CreateTeamWizard
            onClose={() => setWizardOpen(false)}
            onComplete={() => {
              void loadUsers();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* -------------------- Confirm create user dialog -------------------- */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => {
          if (!submitting) setConfirmOpen(o);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden rounded-md border border-border/60 bg-card p-5 text-foreground shadow-2xl shadow-black/40 sm:max-w-lg"
        >
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Create this user?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              The account is created in Supabase Auth and a matching profile row
              is inserted. They can sign in immediately.
            </DialogDescription>
          </DialogHeader>

          {pendingValues && (
            <div className="mt-2 space-y-3 max-h-[50vh] overflow-y-auto scrollbar-hide pr-1">
              <div className="rounded-md border border-border/60 bg-card p-3 space-y-2.5">
                <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                  New user
                </div>
                <div>
                  <div className="text-sm font-semibold leading-tight">
                    {pendingValues.full_name.trim() || "Unnamed user"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {pendingValues.email.trim()}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <SummaryStat
                    label="Role"
                    value={ROLE_LABEL[pendingValues.role]}
                  />
                  <SummaryStat
                    label="Department"
                    value={pendingValues.department?.trim() || "—"}
                  />
                  <SummaryStat
                    label="Manager"
                    value={
                      pendingValues.manager_id
                        ? managerById.get(pendingValues.manager_id)?.full_name ??
                          managerById.get(pendingValues.manager_id)?.email ??
                          "—"
                        : "—"
                    }
                  />
                  <SummaryStat
                    label="Password"
                    value={pendingValues.password}
                    mono
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2 sm:gap-2 sm:justify-center">
            <Button
              variant="ghost"
              className="rounded-sm"
              disabled={submitting}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-sm"
              disabled={submitting}
              onClick={() => void executeCreate()}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Yes, create user
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
                      ? "/spaceman.lottie"
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

function SummaryStat({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-card px-2.5 py-1.5">
      <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`text-xs font-medium truncate ${mono ? "font-mono" : "tabular-nums"}`}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// EditUserDialog — patches full_name / role / manager_id / department.
// Email and password edits are out of scope (auth-level operations).
// Admin role is locked here: existing admins cannot be promoted/demoted from
// this UI, and no one can be promoted to admin. Seed/promote via SQL only.
// -----------------------------------------------------------------------------
const editSchema = z.object({
  full_name: z.string().min(1, "Required"),
  role: z.enum(["EMPLOYEE", "MANAGER"], { message: "Select a role" }),
  manager_id: z.string().optional(),
  department: z.string().optional(),
});

type EditFormValues = z.infer<typeof editSchema>;

interface EditDialogProps {
  user: Profile | null;
  managers: Profile[];
  departments: string[];
  managerById: Map<string, Profile>;
  onClose: () => void;
  onSaved: () => void;
}

function EditUserDialog({
  user,
  managers,
  departments,
  managerById,
  onClose,
  onSaved,
}: EditDialogProps) {
  const adminUpdateUser = useAuthStore((s) => s.adminUpdateUser);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingValues, setPendingValues] = useState<EditFormValues | null>(
    null,
  );
  const [result, setResult] = useState<{
    status: "success" | "error";
    title: string;
    message: string;
  } | null>(null);
  // Display label for the Role combobox. Stored separately so the input can
  // accept partial typing while the underlying enum stays valid.
  const [roleLabel, setRoleLabel] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EditFormValues>({ resolver: zodResolver(editSchema) });

  const isAdminTarget = user?.role === "ADMIN";

  // Hydrate the form whenever the user prop changes (new row clicked).
  // For admin targets the role field is locked, so we seed a benign default
  // ("EMPLOYEE") to satisfy the narrowed schema — it is never sent.
  useEffect(() => {
    if (user) {
      reset({
        full_name: user.full_name ?? "",
        role: user.role === "ADMIN" ? "EMPLOYEE" : user.role,
        manager_id: user.manager_id ?? "",
        department: user.department ?? "",
      });
      setRoleLabel(
        user.role === "ADMIN" ? "" : ROLE_LABEL[user.role] ?? "",
      );
    }
  }, [user, reset]);

  const role = watch("role");
  const managerId = watch("manager_id");
  const department = watch("department");

  // Managers dropdown: exclude the user being edited (a user can't manage themselves)
  const managerOptions = managers.filter((m) => m.id !== user?.id);

  // Autofill Department from the chosen reporting manager's department when
  // editing an employee. Same pattern as the Create flow.
  useEffect(() => {
    if (isAdminTarget) return;
    if (role === "MANAGER") return;
    if (!managerId) return;
    const mgrDept = managerById.get(managerId)?.department?.trim();
    if (!mgrDept) return;
    setValue("department", mgrDept, { shouldValidate: true });
  }, [managerId, role, isAdminTarget, managerById, setValue]);

  // Role combobox: typing one of "employee"/"manager" (case-insensitive) sets
  // the enum; anything else leaves role empty so zod fails on submit.
  const handleRoleLabelChange = (text: string) => {
    setRoleLabel(text);
    const lower = text.trim().toLowerCase();
    if (lower === "employee") {
      setValue("role", "EMPLOYEE", { shouldValidate: true });
    } else if (lower === "manager") {
      setValue("role", "MANAGER", { shouldValidate: true });
      // Managers don't report — clear stale manager_id so it never leaks
      // into the confirm dialog or the DB patch.
      setValue("manager_id", "", { shouldValidate: true });
    } else {
      setValue("role", "" as "EMPLOYEE" | "MANAGER", { shouldValidate: true });
    }
  };

  const onSubmit = handleSubmit((values) => {
    if (!user) return;
    setPendingValues(values);
    setConfirmOpen(true);
  });

  const executeSave = async () => {
    if (!user || !pendingValues) return;
    const values = pendingValues;
    setSaving(true);

    // Build the patch. For admin targets, role and manager_id are intentionally
    // omitted so they remain unchanged.
    const patch: Parameters<typeof adminUpdateUser>[1] = {
      full_name: values.full_name.trim(),
      department: values.department?.trim() || null,
    };
    if (!isAdminTarget) {
      patch.role = values.role;
      patch.manager_id = values.manager_id || null;
    }

    const { error } = await adminUpdateUser(user.id, patch);
    setSaving(false);
    setConfirmOpen(false);

    if (error) {
      setResult({
        status: "error",
        title: "Could not save changes",
        message: error,
      });
      return;
    }

    setResult({
      status: "success",
      title: "Changes saved",
      message: `${values.full_name.trim()} (${user.email}) is updated.`,
    });
    setPendingValues(null);
  };

  // Snapshot helpers for the confirm dialog preview.
  const previewRoleLabel = pendingValues
    ? isAdminTarget
      ? "Admin"
      : ROLE_LABEL[pendingValues.role] ?? "—"
    : "—";
  const previewManagerLabel = pendingValues
    ? isAdminTarget
      ? "—"
      : pendingValues.manager_id
        ? managerById.get(pendingValues.manager_id)?.full_name ??
          managerById.get(pendingValues.manager_id)?.email ??
          "—"
        : "—"
    : "—";

  return (
    <>
      <Dialog open={!!user} onOpenChange={(open) => (!open ? onClose() : undefined)}>
        <DialogContent className="rounded-md border border-border/60 bg-card shadow-2xl shadow-black/40">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight leading-tight">
              Edit user
            </DialogTitle>
            <DialogDescription>
              {user?.email} · Email and password are not editable here.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <div className="space-y-1">
              <Label htmlFor="edit_full_name">Full name</Label>
              <Input id="edit_full_name" {...register("full_name")} />
              {errors.full_name && (
                <p className="text-xs text-destructive">{errors.full_name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Role — combobox (typeable + dropdown). Admin target stays locked. */}
              <div className="space-y-1">
                <Label htmlFor="edit_role">Role</Label>
                {isAdminTarget ? (
                  <div className="flex items-center gap-2 h-8">
                    <Badge variant="default">Admin</Badge>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      id="edit_role"
                      value={roleLabel}
                      onChange={(e) => handleRoleLabelChange(e.target.value)}
                      placeholder="Select Role"
                      className="pr-7"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        type="button"
                        aria-label="Pick role"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground outline-none focus-visible:text-foreground"
                      >
                        <CaretDownIcon className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        sideOffset={4}
                        className="min-w-[10rem] rounded-none border-0 bg-popover p-0 shadow-md ring-1 ring-foreground/10"
                      >
                        <DropdownMenuItem
                          onSelect={() => handleRoleLabelChange("Employee")}
                          className="rounded-none py-2 pl-2 pr-8 text-xs"
                        >
                          Employee
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => handleRoleLabelChange("Manager")}
                          className="rounded-none py-2 pl-2 pr-8 text-xs"
                        >
                          Manager
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
                {errors.role && !isAdminTarget && (
                  <p className="text-xs text-destructive">{errors.role.message}</p>
                )}
              </div>

              {/* Reporting manager — hidden for admins and for MANAGER role. */}
              {!isAdminTarget && role !== "MANAGER" && (
                <div className="space-y-1">
                  <Label htmlFor="edit_manager_id">Reporting manager</Label>
                  <Select
                    value={managerId ?? ""}
                    onValueChange={(v) =>
                      setValue("manager_id", v, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger id="edit_manager_id">
                      <SelectValue placeholder="Select Manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {managerOptions.length === 0 ? (
                        <SelectItem value="__none__" disabled>
                          No managers available
                        </SelectItem>
                      ) : (
                        managerOptions.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.full_name || m.email}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Department — Select (employee), combobox (manager), or plain Input. */}
              <div className="space-y-1">
                <Label htmlFor="edit_department">Department</Label>
                {!isAdminTarget && role !== "MANAGER" && departments.length > 0 ? (
                  <Select
                    value={department || ""}
                    onValueChange={(v) =>
                      setValue("department", v, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger id="edit_department">
                      <SelectValue placeholder="Select Department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (!isAdminTarget && role === "MANAGER") &&
                  departments.length > 0 ? (
                  <div className="relative">
                    <Input
                      id="edit_department"
                      {...register("department")}
                      placeholder="Pick existing or type new"
                      className="pr-7"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        type="button"
                        aria-label="Pick from existing departments"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground outline-none focus-visible:text-foreground"
                      >
                        <CaretDownIcon className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        sideOffset={4}
                        className="min-w-[14rem] rounded-none border-0 bg-popover p-0 shadow-md ring-1 ring-foreground/10"
                      >
                        {departments.map((d) => (
                          <DropdownMenuItem
                            key={d}
                            onSelect={() =>
                              setValue("department", d, {
                                shouldValidate: true,
                              })
                            }
                            className="rounded-none py-2 pl-2 pr-8 text-xs"
                          >
                            {d}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : (
                  <Input
                    id="edit_department"
                    {...register("department")}
                    placeholder={
                      role === "MANAGER" ? "e.g. Sales, Engineering" : "Department"
                    }
                  />
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={saving}
                className="rounded-sm"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="rounded-sm">
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* -------------------- Confirm save dialog -------------------- */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => {
          if (!saving) setConfirmOpen(o);
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="overflow-hidden rounded-md border border-border/60 bg-card p-5 text-foreground shadow-2xl shadow-black/40 sm:max-w-lg"
        >
          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Save these changes?
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Updates the profile row. Email and password stay as they are.
            </DialogDescription>
          </DialogHeader>

          {pendingValues && user && (
            <div className="mt-2 space-y-3 max-h-[50vh] overflow-y-auto scrollbar-hide pr-1">
              <div className="rounded-md border border-border/60 bg-card p-3 space-y-2.5">
                <div className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                  Updated profile
                </div>
                <div>
                  <div className="text-sm font-semibold leading-tight">
                    {pendingValues.full_name.trim() || "Unnamed user"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {user.email}
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  <SummaryStat label="Role" value={previewRoleLabel} />
                  <SummaryStat
                    label="Department"
                    value={pendingValues.department?.trim() || "—"}
                  />
                  <SummaryStat label="Manager" value={previewManagerLabel} />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2 sm:gap-2 sm:justify-center">
            <Button
              variant="ghost"
              className="rounded-sm"
              disabled={saving}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-sm"
              disabled={saving}
              onClick={() => void executeSave()}
            >
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Yes, save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------- Outcome dialog (success / error) ------------- */}
      <Dialog
        open={!!result}
        onOpenChange={(o) => {
          if (!o) {
            const wasSuccess = result?.status === "success";
            setResult(null);
            if (wasSuccess) onSaved();
          }
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
                      ? "/spaceman.lottie"
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
                if (wasSuccess) onSaved();
              }}
            >
              {result?.status === "success" ? "OK" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// -----------------------------------------------------------------------------
// DeleteUserDialog — destructive confirmation. Requires admin to type the
// user's email to confirm, to prevent accidental clicks.
// -----------------------------------------------------------------------------
interface DeleteDialogProps {
  user: Profile | null;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteUserDialog({ user, onClose, onDeleted }: DeleteDialogProps) {
  const adminDeleteUser = useAuthStore((s) => s.adminDeleteUser);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<{
    status: "success" | "error";
    title: string;
    message: string;
  } | null>(null);

  // Reset confirmation text whenever the target changes
  useEffect(() => {
    setConfirmText("");
  }, [user?.id]);

  const canDelete = !!user && confirmText.trim() === user.email && !deleting;

  const handleDelete = async () => {
    if (!user || !canDelete) return;
    setDeleting(true);
    const { error } = await adminDeleteUser(user.id);
    setDeleting(false);
    if (error) {
      setResult({
        status: "error",
        title: "Could not delete user",
        message: error,
      });
      return;
    }
    setResult({
      status: "success",
      title: "User deleted",
      message: `${user.full_name || user.email} has been removed.`,
    });
  };

  return (
    <>
      <Dialog
        open={!!user && !result}
        onOpenChange={(open) => (!open ? onClose() : undefined)}
      >
        <DialogContent className="rounded-md border border-border/60 bg-card shadow-2xl shadow-black/40">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold tracking-tight leading-tight">
              Delete user
            </DialogTitle>
            <DialogDescription>
              This permanently removes{" "}
              <strong>{user?.full_name || user?.email}</strong> and cascades to
              their goal sheets, goals, check-ins, and shared-goal assignments.
              Audit-log entries are preserved. This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirm_email">
              Type the email{" "}
              <span className="font-mono">{user?.email}</span> to confirm:
            </Label>
            <Input
              id="confirm_email"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={user?.email}
              autoComplete="off"
              disabled={deleting}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={deleting}
              className="rounded-sm"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={!canDelete}
              className="rounded-sm"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {deleting ? "Deleting…" : "Delete user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outcome dialog — destructive flow inverts the standard lottie mapping:
          a successful delete shows error.lottie (someone is gone), and a failed
          delete shows success.lottie (no destruction happened). Per user direction. */}
      <Dialog
        open={!!result}
        onOpenChange={(o) => {
          if (!o) {
            const wasSuccess = result?.status === "success";
            if (wasSuccess) onDeleted();
            setResult(null);
          }
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
                      ? "/error.lottie"
                      : "/success.lottie"
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
                if (wasSuccess) onDeleted();
                setResult(null);
              }}
            >
              {result?.status === "success" ? "OK" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
