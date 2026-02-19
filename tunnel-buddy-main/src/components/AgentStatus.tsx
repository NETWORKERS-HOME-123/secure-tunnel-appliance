import { Wifi, WifiOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { api, connectRealtime } from "@/lib/api";

export function AgentStatus() {
  const { user } = useAuth();
  const [hasOnlineTunnels, setHasOnlineTunnels] = useState(false);
  const [tunnelCount, setTunnelCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    if (!user) return;
    try {
      const tunnels = await api.tunnels.list();
      setTunnelCount(tunnels.length);
      setHasOnlineTunnels(tunnels.some((t) => t.status === "online"));
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const ws = connectRealtime((event) => {
      if (event.table === "tunnels") {
        fetchStatus();
      }
    });

    return () => {
      ws?.close();
    };
  }, [user]);

  if (loading) return null;

  if (tunnelCount === 0 || !hasOnlineTunnels) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-destructive/10">
            <WifiOff className="h-4 w-4 text-tunnel-offline" />
          </div>
          <div>
            <p className="text-sm font-medium">No Active Tunnels</p>
            <p className="text-xs text-muted-foreground">
              {tunnelCount === 0
                ? "Create a tunnel to expose a local service"
                : "All tunnels are currently offline"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 border-glow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
            <Wifi className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Tunnels Active</p>
            <p className="font-mono text-xs text-muted-foreground">
              {tunnelCount} tunnel{tunnelCount !== 1 ? "s" : ""} configured
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-tunnel-online animate-pulse-glow" />
          <span className="text-xs text-tunnel-online font-mono">live</span>
        </div>
      </div>
    </div>
  );
}
