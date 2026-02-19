import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTunnels } from "@/hooks/useTunnels";
import { Loader2, Eye, RefreshCw } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils-format";
import { formatBytes } from "@/lib/utils-format";

interface ConnectionLog {
  id: string;
  tunnel_id: string;
  method: string | null;
  path: string | null;
  status_code: number | null;
  latency_ms: number | null;
  bytes_transferred: number;
  source_ip: string | null;
  created_at: string;
}

export function RequestInspector() {
  const { user } = useAuth();
  const { tunnels } = useTunnels();
  const [selectedTunnel, setSelectedTunnel] = useState<string>("all");
  const [logs, setLogs] = useState<ConnectionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ConnectionLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    if (!user) return;
    try {
      const data = await api.analytics.connectionLogs(selectedTunnel, 100);
      setLogs(data ?? []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [user, selectedTunnel]);

  const getStatusColor = (code: number | null) => {
    if (!code) return "text-muted-foreground";
    if (code < 300) return "text-tunnel-online";
    if (code < 400) return "text-tunnel-tcp";
    return "text-tunnel-offline";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={selectedTunnel} onValueChange={setSelectedTunnel}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue placeholder="Filter by tunnel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tunnels</SelectItem>
            {tunnels.map((t: any) => (
              <SelectItem key={t.id} value={t.id}>{t.tunnel_id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchLogs}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">No requests recorded yet</p>
      ) : (
        <div className="flex gap-4">
          <div className="flex-1 space-y-1 max-h-[400px] overflow-y-auto">
            {logs.map((log) => (
              <button
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className={`w-full text-left rounded-md px-3 py-2 text-xs font-mono transition-colors hover:bg-muted ${
                  selectedLog?.id === log.id ? "bg-muted border border-primary/30" : "border border-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] w-12 justify-center">{log.method || "—"}</Badge>
                  <span className={getStatusColor(log.status_code)}>{log.status_code ?? "—"}</span>
                  <span className="text-muted-foreground truncate flex-1">{log.path || "/"}</span>
                  <span className="text-muted-foreground shrink-0">{log.latency_ms ? `${log.latency_ms}ms` : ""}</span>
                </div>
              </button>
            ))}
          </div>

          {selectedLog && (
            <div className="w-72 shrink-0 rounded-lg border border-border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Request Details</span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span>{selectedLog.method || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Path</span>
                  <span className="truncate ml-2">{selectedLog.path || "/"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={getStatusColor(selectedLog.status_code)}>{selectedLog.status_code ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Latency</span>
                  <span>{selectedLog.latency_ms ? `${selectedLog.latency_ms}ms` : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bytes</span>
                  <span>{formatBytes(selectedLog.bytes_transferred)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Source IP</span>
                  <span>{selectedLog.source_ip || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time</span>
                  <span>{formatRelativeTime(selectedLog.created_at)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
