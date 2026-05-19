import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Target, LineChart, Users } from "lucide-react";
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
import { Meteors } from "@/components/ui/magicui/meteors";
import { ShimmerButton } from "@/components/ui/magicui/shimmer-button";
import { WordFadeIn } from "@/components/ui/magicui/word-fade-in";
import { Globe } from "@/components/ui/magicui/globe";
import { BlurFade } from "@/components/ui/magicui/blur-fade";
import { DotPattern } from "@/components/ui/magicui/dot-pattern";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/authStore";
import logoUrl from "@/assets/logo.svg";
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
    <div className="relative min-h-screen w-full bg-background lg:grid lg:grid-cols-[3fr_2fr]">
      <aside className="relative hidden overflow-hidden border-r border-border bg-card/40 lg:flex lg:flex-col lg:p-10">
        <Meteors number={18} />

        <Globe className="pointer-events-none absolute -right-40 -bottom-40 w-[640px] opacity-60" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 20% 0%, color-mix(in oklch, var(--neon-violet) 12%, transparent), transparent 55%)",
          }}
        />

        <div className="relative z-10 flex items-center gap-4">
          <img src={logoUrl} alt="" aria-hidden="true" className="h-20 w-20" />
          <span className="font-spock text-4xl font-bold tracking-tight">AtomAlign</span>
        </div>

        <div className="relative z-10 mt-10 flex flex-col gap-8 pb-8">
          <BlurFade>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
              <span className="font-mono text-foreground/70">{"{ }"}</span>
              Goal alignment workspace
            </div>
          </BlurFade>

          <BlurFade delay={0.1}>
            <h1 className="font-founders text-4xl font-semibold leading-tight tracking-tight">
              Align goals at the
              <br /> speed of execution.
            </h1>
          </BlurFade>

          <BlurFade delay={0.2}>
            <p className="max-w-md text-sm text-muted-foreground">
              Set goals, cascade them across your org, and track progress in real
              time — without losing sight of the people behind the numbers.
            </p>
          </BlurFade>

          <BlurFade delay={0.3}>
            <ul className="grid gap-5 pt-12">
              <Feature
                icon={<Target className="h-4 w-4" />}
                title="Goal Cascading"
                description="Connect company objectives to team and individual goals in a single graph."
              />
              <Feature
                icon={<LineChart className="h-4 w-4" />}
                title="Real-time Tracking"
                description="See progress, blockers, and check-ins as they happen — not at quarter-end."
              />
              <Feature
                icon={<Users className="h-4 w-4" />}
                title="Manager Insights"
                description="Spot trends across teams and surface escalations before they slip."
              />
            </ul>
          </BlurFade>
        </div>

      </aside>

      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 lg:min-h-0">
        <DotPattern
          width={22}
          height={22}
          radius={1}
          className="text-foreground/[0.07] [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]"
        />
        <div className="absolute inset-0 lg:hidden">
          <Meteors number={20} />
        </div>
        <Card className="relative rounded-md w-full max-w-sm border-border/60 shadow-2xl shadow-black/40 backdrop-blur">
        <CardHeader>
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="" aria-hidden="true" className="h-12 w-12 shrink-0" />
            <div className="flex flex-col">
              <CardTitle className="text-2xl leading-tight">
                <WordFadeIn text="AtomAlign" className="font-spock font-bold" />
              </CardTitle>
              <CardDescription>Goal Setting & Tracking</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                {...register("email")}
              />
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
            <ShimmerButton
              type="submit"
              className="w-full"
              disabled={submitting || msSubmitting}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {submitting ? "Signing in…" : "Sign in"}
            </ShimmerButton>
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
      </main>
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-l border border-border bg-background/60 text-foreground/80">
        {icon}
      </span>
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </li>
  );
}
