import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/authStore";
import type { UserRole } from "@/types";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

const ROLE_HOME: Record<UserRole, string> = {
  EMPLOYEE: "/employee/dashboard",
  MANAGER: "/manager/dashboard",
  ADMIN: "/admin/dashboard",
};

export default function LoginPage() {
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signIn);
  const signInWithMicrosoft = useAuthStore((s) => s.signInWithMicrosoft);
  const [submitting, setSubmitting] = useState(false);
  const [msSubmitting, setMsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // If a session is already established (persisted token, or fresh sign-in
  // just resolved), redirect synchronously so the form never paints.
  if (user) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    const { error } = await signIn(values.email, values.password);
    setSubmitting(false);
    if (error) {
      toast({ title: "Sign in failed", description: error, variant: "destructive" });
    }
  });

  const onMicrosoftSignIn = async () => {
    setMsSubmitting(true);
    const { error } = await signInWithMicrosoft();
    if (error) {
      setMsSubmitting(false);
      toast({
        title: "Microsoft sign-in failed",
        description: error,
        variant: "destructive",
      });
    }
    // On success the browser is redirected to Microsoft — no further UI work.
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>AtomAlign — Goal Setting & Tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register("email")} />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={submitting || msSubmitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={onMicrosoftSignIn}
            disabled={submitting || msSubmitting}
          >
            {msSubmitting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <svg
                className="h-4 w-4 mr-2"
                viewBox="0 0 21 21"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
            )}
            {msSubmitting ? "Redirecting…" : "Sign in with Microsoft"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
