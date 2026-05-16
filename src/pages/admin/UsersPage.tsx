import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/hooks/use-toast";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Profile, UserRole } from "@/types";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Minimum 6 characters"),
  full_name: z.string().min(1, "Required"),
  // Admin role intentionally not creatable from this form — seed admins via
  // Supabase SQL or promote an existing user via the edit dialog.
  role: z.enum(["EMPLOYEE", "MANAGER"]),
  manager_id: z.string().optional(),
  department: z.string().optional(),
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
  const { toast } = useToast();
  const adminCreateUser = useAuthStore((s) => s.adminCreateUser);
  const currentAdminId = useAuthStore((s) => s.user?.id);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState<Profile | null>(null);

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
      role: "EMPLOYEE",
      manager_id: "",
      department: "",
    },
  });

  const role = watch("role");
  const managerId = watch("manager_id");

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

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    const { error } = await adminCreateUser({
      email: values.email.trim(),
      password: values.password,
      full_name: values.full_name.trim(),
      role: values.role,
      manager_id: values.role === "EMPLOYEE" ? values.manager_id || null : null,
      department: values.department?.trim() || null,
    });
    setSubmitting(false);

    if (error) {
      toast({
        title: "Could not create user",
        description: error,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "User created",
      description: `${values.full_name} (${values.email}) can now sign in.`,
    });
    reset({
      email: "",
      password: "",
      full_name: "",
      role: "EMPLOYEE",
      manager_id: "",
      department: "",
    });
    void loadUsers();
  });

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create new employees, managers, and admins. New users can sign in
          immediately with the email and password set below.
        </p>
      </div>

      <Card>
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
              <div className="space-y-1">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={role}
                  onValueChange={(v) =>
                    setValue("role", v as "EMPLOYEE" | "MANAGER", {
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="MANAGER">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="department">Department (optional)</Label>
                <Input
                  id="department"
                  {...register("department")}
                  placeholder="e.g. Sales, Engineering"
                />
              </div>
              {role === "EMPLOYEE" && (
                <div className="space-y-1">
                  <Label htmlFor="manager_id">Reporting manager (optional)</Label>
                  <Select
                    value={managerId ?? ""}
                    onValueChange={(v) =>
                      setValue("manager_id", v, { shouldValidate: true })
                    }
                  >
                    <SelectTrigger id="manager_id">
                      <SelectValue placeholder="No manager" />
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
            </div>

            <div className="flex justify-end pt-1">
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                {submitting ? "Creating…" : "Create user"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
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
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditing(u)}
                            aria-label={`Edit ${u.full_name || u.email}`}
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
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <EditUserDialog
        user={editing}
        managers={managers}
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
  role: z.enum(["EMPLOYEE", "MANAGER"]),
  manager_id: z.string().optional(),
  department: z.string().optional(),
});

type EditFormValues = z.infer<typeof editSchema>;

interface EditDialogProps {
  user: Profile | null;
  managers: Profile[];
  onClose: () => void;
  onSaved: () => void;
}

function EditUserDialog({ user, managers, onClose, onSaved }: EditDialogProps) {
  const { toast } = useToast();
  const adminUpdateUser = useAuthStore((s) => s.adminUpdateUser);
  const [saving, setSaving] = useState(false);

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
    }
  }, [user, reset]);

  const role = watch("role");
  const managerId = watch("manager_id");

  // Managers dropdown: exclude the user being edited (a user can't manage themselves)
  const managerOptions = managers.filter((m) => m.id !== user?.id);

  const onSubmit = handleSubmit(async (values) => {
    if (!user) return;
    setSaving(true);

    // Build the patch. For admin targets, role and manager_id are intentionally
    // omitted so they remain unchanged.
    const patch: Parameters<typeof adminUpdateUser>[1] = {
      full_name: values.full_name.trim(),
      department: values.department?.trim() || null,
    };
    if (!isAdminTarget) {
      patch.role = values.role;
      patch.manager_id =
        values.role === "EMPLOYEE" ? values.manager_id || null : null;
    }

    const { error } = await adminUpdateUser(user.id, patch);
    setSaving(false);

    if (error) {
      toast({ title: "Could not save changes", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "User updated", description: user.email });
    onSaved();
  });

  return (
    <Dialog open={!!user} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
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

          <div className="space-y-1">
            <Label htmlFor="edit_role">Role</Label>
            {isAdminTarget ? (
              <div className="flex items-center gap-2 h-8">
                <Badge variant="default">Admin</Badge>
                <span className="text-xs text-muted-foreground">
                  Locked — change via SQL
                </span>
              </div>
            ) : (
              <Select
                value={role ?? "EMPLOYEE"}
                onValueChange={(v) =>
                  setValue("role", v as "EMPLOYEE" | "MANAGER", {
                    shouldValidate: true,
                  })
                }
              >
                <SelectTrigger id="edit_role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit_department">Department</Label>
            <Input id="edit_department" {...register("department")} placeholder="—" />
          </div>

          {!isAdminTarget && role === "EMPLOYEE" && (
            <div className="space-y-1">
              <Label htmlFor="edit_manager_id">Reporting manager</Label>
              <Select
                value={managerId ?? ""}
                onValueChange={(v) =>
                  setValue("manager_id", v, { shouldValidate: true })
                }
              >
                <SelectTrigger id="edit_manager_id">
                  <SelectValue placeholder="No manager" />
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
  const { toast } = useToast();
  const adminDeleteUser = useAuthStore((s) => s.adminDeleteUser);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

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
      toast({ title: "Could not delete user", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "User deleted", description: user.email });
    onDeleted();
  };

  return (
    <Dialog open={!!user} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            This permanently removes <strong>{user?.full_name || user?.email}</strong>{" "}
            and cascades to their goal sheets, goals, check-ins, and shared-goal
            assignments. Audit-log entries are preserved. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="confirm_email">
            Type the email <span className="font-mono">{user?.email}</span> to confirm:
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

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete}
          >
            {deleting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            {deleting ? "Deleting…" : "Delete user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
