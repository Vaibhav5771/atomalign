import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { GoalSheetWithEmployee } from "@/types";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export function TeamTable({ rows }: { rows: GoalSheetWithEmployee[] }) {
  if (rows.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-none p-6 text-center text-sm text-muted-foreground">
        No direct reports found.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead className="text-right">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const hasSheet = !!r.id;
          const reviewable = hasSheet && (r.status === "SUBMITTED" || r.status === "APPROVED");
          return (
            <TableRow key={r.employee_id}>
              <TableCell>
                <div className="font-medium">{r.employee.full_name || r.employee.email}</div>
                <div className="text-xs text-muted-foreground">{r.employee.email}</div>
              </TableCell>
              <TableCell className="text-sm">{r.employee.department ?? "—"}</TableCell>
              <TableCell>
                {hasSheet ? (
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={r.status} />
                    {r.reopened_by && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 border border-amber-400 bg-amber-50 text-amber-800 font-medium uppercase tracking-wide"
                        title="Sheet was reopened by admin"
                      >
                        Reopened
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">Not started</span>
                )}
              </TableCell>
              <TableCell className="text-sm">{formatDate(r.submitted_at)}</TableCell>
              <TableCell className="text-right">
                {reviewable ? (
                  <Button asChild size="sm">
                    <Link to={`/manager/review/${r.id}`}>Review</Link>
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" disabled>
                    {r.status === "DRAFT" && hasSheet ? "Awaiting submission" : "—"}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
