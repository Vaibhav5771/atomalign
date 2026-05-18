import { createRef, useMemo, useRef } from "react";
import { ShieldCheck, Briefcase, User, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BlurFade } from "@/components/ui/magicui/blur-fade";
import { AnimatedBeam } from "@/components/ui/magicui/animated-beam";
import { DotPattern } from "@/components/ui/magicui/dot-pattern";
import { cn } from "@/lib/utils";

export interface SummaryEmployeeNode {
  id: string;
  full_name: string;
  email: string;
  password?: string;
  isNew: boolean;
}

export interface SummaryManagerNode {
  mgrId?: string;
  mgrName: string;
  mgrEmail: string;
  mgrRole: string;
  mgrPassword?: string;
  isNew: boolean;
  employees: SummaryEmployeeNode[];
}

export interface AdminNode {
  name: string;
  email: string;
  role: string;
}

export interface TreeSelection {
  selected: Set<string>;
  onToggle: (id: string) => void;
}

export function TeamTree({
  admin,
  tree,
  selection,
}: {
  admin: AdminNode;
  tree: SummaryManagerNode[];
  selection?: TreeSelection;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const adminRef = useRef<HTMLDivElement>(null);

  const managerRefs = useMemo(
    () => tree.map(() => createRef<HTMLDivElement>()),
    [tree],
  );
  const employeeRefMatrix = useMemo(
    () =>
      tree.map((node) => node.employees.map(() => createRef<HTMLDivElement>())),
    [tree],
  );

  // Branch curvature falls off the further out the manager is from center —
  // gives the canopy a more organic outward arc, like real branches.
  const branchCurvature = (mi: number) => {
    const center = (tree.length - 1) / 2;
    const distance = Math.abs(mi - center);
    return 60 + distance * 18;
  };

  return (
    <BlurFade delay={0.1}>
      <div
        ref={containerRef}
        className="relative min-w-fit overflow-hidden rounded-md border border-border/60 bg-card/40 px-8 pb-10 pt-12"
      >
        <DotPattern
          width={24}
          height={24}
          radius={1}
          className="text-foreground/[0.05] [mask-image:radial-gradient(ellipse_at_top,white,transparent_75%)]"
        />

        {/* Tier 1 — Admin (the trunk) */}
        <div className="relative z-10 flex justify-center">
          <div
            ref={adminRef}
            className="relative flex max-w-md flex-col items-center gap-1.5 rounded-md border border-primary/50 bg-card px-6 py-4 text-center shadow-[0_0_32px_-8px_color-mix(in_oklch,var(--primary)_60%,transparent)]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
              {admin.role}
            </div>
            <div className="text-base font-semibold tracking-tight">
              {admin.name}
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              {admin.email}
            </div>
          </div>
        </div>

        {/* Tier 2 + Tier 3 — managers (branches) with their employees (leaves) */}
        {tree.length > 0 ? (
          <div className="relative z-10 mt-24 flex flex-wrap justify-center gap-x-10 gap-y-14">
            {tree.map((node, mi) => {
              const mgrSelectable = !!(selection && node.mgrId);
              const mgrSelected = mgrSelectable
                ? selection!.selected.has(node.mgrId!)
                : false;
              const onMgrToggle = () => {
                if (mgrSelectable) selection!.onToggle(node.mgrId!);
              };
              return (
                <div
                  key={node.mgrEmail}
                  className="flex flex-col items-center gap-8"
                >
                  <div
                    ref={managerRefs[mi]}
                    role={mgrSelectable ? "button" : undefined}
                    tabIndex={mgrSelectable ? 0 : undefined}
                    onClick={mgrSelectable ? onMgrToggle : undefined}
                    onKeyDown={
                      mgrSelectable
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onMgrToggle();
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      "relative flex min-w-[210px] max-w-[260px] flex-col items-center gap-1 rounded-md border bg-card px-3.5 py-3 text-center transition-colors",
                      mgrSelectable && "cursor-pointer",
                      mgrSelectable
                        ? mgrSelected
                          ? "border-primary/70 shadow-[0_0_22px_-6px_color-mix(in_oklch,var(--primary)_65%,transparent)]"
                          : "border-border/60 hover:border-primary/40"
                        : mgrSelected
                          ? "border-primary/70 shadow-[0_0_22px_-6px_color-mix(in_oklch,var(--primary)_65%,transparent)]"
                          : "border-primary/35 shadow-[0_0_18px_-8px_color-mix(in_oklch,var(--primary)_45%,transparent)] hover:border-primary/50",
                    )}
                  >
                    {mgrSelectable && (
                      <SelectionCheckbox selected={mgrSelected} />
                    )}
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary/80">
                      <Briefcase className="h-3.5 w-3.5" />
                    </div>
                    <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-primary/70">
                      {node.mgrRole}
                    </div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      {node.mgrName}
                      {node.isNew && (
                        <Badge
                          variant="secondary"
                          className="h-4 py-0 text-[10px] leading-none"
                        >
                          New
                        </Badge>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {node.mgrEmail}
                    </div>
                    {node.isNew && node.mgrPassword && (
                      <div className="mt-1 rounded-sm border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                        <span className="mr-0.5 text-muted-foreground">pw:</span>
                        {node.mgrPassword}
                      </div>
                    )}
                  </div>

                  {node.employees.length > 0 ? (
                    <div className="flex flex-col items-center gap-2.5">
                      {node.employees.map((e, ei) => {
                        const empSelectable = !!selection;
                        const empSelected = empSelectable
                          ? selection!.selected.has(e.id)
                          : false;
                        const onEmpToggle = () => {
                          if (empSelectable) selection!.onToggle(e.id);
                        };
                        return (
                          <div
                            key={e.id}
                            ref={employeeRefMatrix[mi][ei]}
                            role={empSelectable ? "button" : undefined}
                            tabIndex={empSelectable ? 0 : undefined}
                            onClick={empSelectable ? onEmpToggle : undefined}
                            onKeyDown={
                              empSelectable
                                ? (ev) => {
                                    if (ev.key === "Enter" || ev.key === " ") {
                                      ev.preventDefault();
                                      onEmpToggle();
                                    }
                                  }
                                : undefined
                            }
                            className={cn(
                              "relative flex min-w-[210px] max-w-[260px] items-center gap-2 rounded-md border bg-card px-3 py-1.5 shadow-sm transition-colors",
                              empSelectable && "cursor-pointer",
                              empSelected
                                ? "border-primary/60 shadow-[0_0_16px_-8px_color-mix(in_oklch,var(--primary)_55%,transparent)]"
                                : "border-border/60 hover:border-primary/30",
                            )}
                          >
                            {empSelectable && (
                              <SelectionCheckbox selected={empSelected} compact />
                            )}
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                              <User className="h-3 w-3" />
                            </div>
                            <div className="flex flex-1 flex-col gap-0 text-left min-w-0">
                              <div className="flex items-center gap-1.5 text-xs font-medium leading-tight">
                                <span className="truncate">{e.full_name}</span>
                                {e.isNew && (
                                  <Badge
                                    variant="secondary"
                                    className="h-3.5 shrink-0 py-0 text-[9px] leading-none"
                                  >
                                    New
                                  </Badge>
                                )}
                              </div>
                              <div className="truncate font-mono text-[10px] text-muted-foreground">
                                {e.email}
                              </div>
                            </div>
                            {e.isNew && e.password && (
                              <div className="shrink-0 rounded-sm border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                                {e.password}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[10px] italic text-muted-foreground">
                      No direct reports
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="relative z-10 mt-12 text-center text-xs italic text-muted-foreground">
            No managers yet.
          </div>
        )}

        {/* Beams: admin → each manager */}
        {tree.map((node, mi) => (
          <AnimatedBeam
            key={`a-${node.mgrEmail}`}
            containerRef={containerRef}
            fromRef={adminRef}
            toRef={managerRefs[mi]}
            curvature={branchCurvature(mi)}
            duration={5}
            delay={mi * 0.35}
            pathOpacity={0.4}
            pathWidth={2.5}
          />
        ))}

        {/* Beams: each manager → each employee */}
        {tree.map((node, mi) =>
          node.employees.map((e, ei) => (
            <AnimatedBeam
              key={`m-${node.mgrEmail}-e-${e.id}`}
              containerRef={containerRef}
              fromRef={managerRefs[mi]}
              toRef={employeeRefMatrix[mi][ei]}
              curvature={15 + ei * 6}
              duration={4}
              delay={mi * 0.35 + ei * 0.18}
              pathOpacity={0.3}
              gradientStartColor="var(--neon-blue)"
              gradientStopColor="var(--primary)"
            />
          )),
        )}
      </div>
    </BlurFade>
  );
}

function SelectionCheckbox({
  selected,
  compact = false,
}: {
  selected: boolean;
  compact?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute flex items-center justify-center rounded-full border transition-colors",
        compact
          ? "top-1 right-1 h-4 w-4"
          : "top-2 right-2 h-5 w-5",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border/70 bg-card",
      )}
    >
      {selected && (
        <Check className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} strokeWidth={3} />
      )}
    </span>
  );
}
