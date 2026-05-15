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
                  <StatusBadge status={r.status} />
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
