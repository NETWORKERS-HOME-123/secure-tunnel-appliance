import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";

export function ConnectionLogExport() {
  const { user } = useAuth();
  const [format, setFormat] = useState<"json" | "csv">("csv");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);

    if (!user) { setExporting(false); return; }

    let data: any[] | null = null;
    try {
      data = await api.analytics.connectionLogs(undefined, 1000);
    } catch {
      toast.error("Failed to export logs");
      setExporting(false);
      return;
    }

    if (!data) { setExporting(false); return; }

    let content: string;
    let mime: string;
    let ext: string;

    if (format === "json") {
      content = JSON.stringify(data, null, 2);
      mime = "application/json";
      ext = "json";
    } else {
      const headers = ["id", "tunnel_id", "method", "path", "status_code", "latency_ms", "bytes_transferred", "source_ip", "created_at"];
      const rows = data.map((row: any) => headers.map((h) => JSON.stringify(row[h] ?? "")).join(","));
      content = [headers.join(","), ...rows].join("\n");
      mime = "text/csv";
      ext = "csv";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `connection-logs-${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Exported ${data.length} logs`);
    setExporting(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={format} onValueChange={(v: any) => setFormat(v)}>
        <SelectTrigger className="w-[100px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="csv">CSV</SelectItem>
          <SelectItem value="json">JSON</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting} className="gap-1.5 h-8">
        {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Export Logs
      </Button>
    </div>
  );
}
