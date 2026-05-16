import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { AuditRow } from "@/stores/reportsStore";

interface Props {
  rows: AuditRow[];
  loading?: boolean;
}

const ACTION_BADGE: Record<
  string,
  { variant: "default" | "secondary" | "outline" | "destructive"; className?: string }
> = {
  APPROVED: { variant: "default", className: "bg-emerald-600 hover:bg-emerald-600" },
  APPROVE: { variant: "default", className: "bg-emerald-600 hover:bg-emerald-600" },
  RETURN: { variant: "secondary", className: "bg-amber-500 text-white hover:bg-amber-500" },
  RETURNED: { variant: "secondary", className: "bg-amber-500 text-white hover:bg-amber-500" },
  REOPEN_BY_ADMIN: {
    variant: "secondary",
    className: "bg-amber-500 text-white hover:bg-amber-500",
  },
  CHECK_IN_SAVED: { variant: "default", className: "bg-sky-600 hover:bg-sky-600" },
  MANAGER_COMMENT_SAVED: { variant: "secondary" },
  ADMIN_DELETED_USER: {
    variant: "destructive",
    className: "bg-rose-600 text-white hover:bg-rose-600",
  },
};

function ActionBadge({ action }: { action: string }) {
  const cfg = ACTION_BADGE[action] ?? { variant: "outline" as const };
  return (
    <Badge variant={cfg.variant} className={cfg.className}>
      {action}
    </Badge>
  );
}

// Render a compact preview of a JSON value as small key:value chips. Falls back
// to a single line for primitives. Caps at 3 entries with "+N more".
function ValuePreview({ value }: { value: unknown }) {
  if (value == null) {
    return <span className="text-muted-foreground">—</span>;
  }

  // Primitive: just render its string form
  if (typeof value !== "object" || Array.isArray(value)) {
    const text = String(value);
    return (
      <span className="text-xs text-foreground">
        {text.length > 60 ? `${text.slice(0, 60)}…` : text}
      </span>
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return <span className="text-muted-foreground italic">empty</span>;
  }

  const MAX = 3;
  const visible = entries.slice(0, MAX);
  const overflow = entries.length - visible.length;

  const formatValue = (v: unknown): string => {
    if (v === null) return "null";
    if (typeof v === "string") {
      return v.length > 24 ? `${v.slice(0, 24)}…` : v;
    }
    if (typeof v === "object") return Array.isArray(v) ? "[…]" : "{…}";
    return String(v);
  };

  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
      {visible.map(([k, v]) => (
        <span key={k} className="inline-flex items-baseline gap-1">
          <span className="text-muted-foreground font-medium">{k}:</span>
          <span className="font-mono text-foreground">{formatValue(v)}</span>
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-muted-foreground italic">+{overflow} more</span>
      )}
    </div>
  );
}

// Recursively renders a JSON-ish value with type-aware styling. Objects render
// as a definition list (key | value), nested objects indent.
function StructuredValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground italic">null</span>;
  }
  if (typeof value === "string") {
    if (value === "") {
      return <span className="text-muted-foreground italic">empty string</span>;
    }
    return (
      <span className="font-mono text-emerald-700 dark:text-emerald-400 break-all">
        "{value}"
      </span>
    );
  }
  if (typeof value === "number") {
    return (
      <span className="font-mono text-sky-700 dark:text-sky-400 tabular-nums">
        {value}
      </span>
    );
  }
  if (typeof value === "boolean") {
    return (
      <span className="font-mono text-violet-700 dark:text-violet-400">
        {String(value)}
      </span>
    );
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-muted-foreground italic">empty array</span>;
    }
    return (
      <ol className="list-decimal list-inside space-y-1 ml-2">
        {value.map((item, i) => (
          <li key={i} className="text-xs">
            <StructuredValue value={item} />
          </li>
        ))}
      </ol>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return <span className="text-muted-foreground italic">empty object</span>;
    }
    return (
      <dl className="space-y-1.5">
        {entries.map(([k, v]) => (
          <div
            key={k}
            className="grid grid-cols-[max-content_1fr] gap-x-3 items-baseline"
          >
            <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {k}
            </dt>
            <dd className="text-xs">
              <StructuredValue value={v} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  return <span className="font-mono text-xs">{String(value)}</span>;
}

function JsonBlock({ value }: { value: unknown }) {
  if (value == null) {
    return (
      <div className="rounded border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground italic">
        No data
      </div>
    );
  }
  return (
    <div className="rounded border border-border bg-muted/30 px-3 py-2 overflow-x-auto">
      <StructuredValue value={value} />
    </div>
  );
}

export function AuditTable({ rows, loading }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead className="w-44">Timestamp</TableHead>
            <TableHead>Changed By</TableHead>
            <TableHead className="w-48">Action</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Old Value</TableHead>
            <TableHead>New Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                Loading…
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                No audit entries yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => {
              const isOpen = expanded.has(r.id);
              const reference = r.goal_title
                ? `Goal · ${r.goal_title}`
                : r.sheet_id
                  ? `Sheet · ${r.sheet_id.slice(0, 8)}`
                  : "—";
              return (
                <Fragment key={r.id}>
                  <TableRow
                    className={cn(
                      "cursor-pointer hover:bg-muted/50",
                      isOpen && "bg-muted/30",
                    )}
                    onClick={() => toggle(r.id)}
                  >
                    <TableCell className="align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(r.id);
                        }}
                        aria-label={isOpen ? "Collapse row" : "Expand row"}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground align-top whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="align-top">
                      {r.changed_by_name ?? (
                        <span className="text-muted-foreground italic">deleted user</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <ActionBadge action={r.action} />
                    </TableCell>
                    <TableCell className="align-top text-sm">{reference}</TableCell>
                    <TableCell className="align-top max-w-[16rem]">
                      <ValuePreview value={r.old_value} />
                    </TableCell>
                    <TableCell className="align-top max-w-[20rem]">
                      <ValuePreview value={r.new_value} />
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="bg-muted/20">
                      <TableCell />
                      <TableCell colSpan={6} className="py-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">
                              Old value
                            </div>
                            <JsonBlock value={r.old_value} />
                          </div>
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-1">
                              New value
                            </div>
                            <JsonBlock value={r.new_value} />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
