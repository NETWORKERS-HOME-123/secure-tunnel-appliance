import { useState } from "react";
import { useTunnels } from "@/hooks/useTunnels";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Download, Upload, FileJson, Loader2 } from "lucide-react";

interface TunnelExport {
  version: 1;
  exported_at: string;
  tunnels: Array<{
    type: string;
    local_port: number;
    public_endpoint: string;
    expires_at: string | null;
  }>;
}

export function ExportImportConfig() {
  const { tunnels, createTunnel } = useTunnels();
  const [importing, setImporting] = useState(false);

  const handleExport = () => {
    const config: TunnelExport = {
      version: 1,
      exported_at: new Date().toISOString(),
      tunnels: tunnels.map((t) => ({
        type: t.type,
        local_port: t.local_port,
        public_endpoint: t.public_endpoint,
        expires_at: t.expires_at,
      })),
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ultraslim-tunnels-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${tunnels.length} tunnel(s)`);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const text = await file.text();
      const config = JSON.parse(text) as TunnelExport;

      if (config.version !== 1 || !Array.isArray(config.tunnels)) {
        throw new Error("Invalid config format");
      }

      let created = 0;
      for (const t of config.tunnels) {
        if (!t.type || !t.local_port) continue;
        try {
          await createTunnel(
            t.type as "http" | "tcp",
            t.local_port,
            undefined
          );
          created++;
        } catch {
          // skip individual failures (e.g. limit reached)
        }
      }

      toast.success(`Imported ${created} of ${config.tunnels.length} tunnel(s)`);
    } catch (err: any) {
      toast.error(err.message || "Failed to import config");
    }
    setImporting(false);
    // Reset input
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Export your tunnel configurations as JSON for backup or import on another account.
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        <Button variant="outline" onClick={handleExport} disabled={tunnels.length === 0} className="gap-2">
          <Download className="h-4 w-4" />
          Export ({tunnels.length})
        </Button>

        <div className="relative">
          <Button variant="outline" disabled={importing} className="gap-2" asChild>
            <label className="cursor-pointer">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import
              <input type="file" accept=".json" onChange={handleImport} className="sr-only" />
            </label>
          </Button>
        </div>
      </div>

      {tunnels.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center gap-2 mb-2">
            <FileJson className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium">Preview</span>
          </div>
          <pre className="text-[10px] font-mono text-muted-foreground max-h-32 overflow-y-auto">
            {JSON.stringify(
              tunnels.slice(0, 3).map((t) => ({ type: t.type, local_port: t.local_port, endpoint: t.public_endpoint })),
              null,
              2
            )}
            {tunnels.length > 3 && `\n... and ${tunnels.length - 3} more`}
          </pre>
        </div>
      )}
    </div>
  );
}
