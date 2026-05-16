import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Props<T extends Record<string, unknown>> {
  data: T[];
  filename: string;
  label?: string;
  sheetName?: string;
  disabled?: boolean;
}

function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ExportButton<T extends Record<string, unknown>>({
  data,
  filename,
  label = "Export",
  sheetName = "Sheet1",
  disabled,
}: Props<T>) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    if (busy) return;
    if (data.length === 0) {
      toast({ title: "Nothing to export", description: "The current view has no rows." });
      return;
    }
    setBusy(true);
    try {
      // Yield to the browser so the spinner paints before SheetJS blocks.
      await new Promise((r) => setTimeout(r, 0));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `${filename}-${todayStamp()}.xlsx`);
      toast({ title: "Export complete", description: `${data.length} row(s) downloaded.` });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Export failed", description: message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button type="button" onClick={handleExport} disabled={disabled || busy}>
      {busy ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-1" />
      )}
      {busy ? "Exporting…" : label}
    </Button>
  );
}
