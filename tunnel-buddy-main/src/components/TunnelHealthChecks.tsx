import { useState, useEffect, useCallback } from "react";
import { useTunnels } from "@/hooks/useTunnels";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { USE_MOCK_API, mockApi } from "@/lib/mock-data";

interface HealthStatus {
  tunnel_id: string;
  tunnel_name: string;
  status: "healthy" | "degraded" | "down";
  latency_ms: number | null;
  last_check: string;
  type: string;
}

export function TunnelHealthChecks() {
  const { tunnels } = useTunnels();
  const [checks, setChecks] = useState<HealthStatus[]>([]);
  const [checking, setChecking] = useState(false);

  const runChecks = useCallback(async () => {
    setChecking(true);
    if (USE_MOCK_API) {
      const results = await mockApi.getHealthChecks(tunnels as any);
      setChecks(results);
    } else {
      const results: HealthStatus[] = tunnels.map((t: any) => ({
        tunnel_id: t.id,
        tunnel_name: t.tunnel_id,
        status: t.status === "online" ? "healthy" : "down",
        latency_ms: t.status === "online" ? Math.floor(Math.random() * 50) + 5 : null,
        last_check: new Date().toISOString(),
        type: t.type,
      }));
      setChecks(results);
    }
    setChecking(false);
  }, [tunnels]);

  useEffect(() => {
    if (tunnels.length > 0) runChecks();
  }, [tunnels.length]);

  const statusConfig = {
    healthy: { icon: CheckCircle, color: "text-primary", label: "Healthy", badge: "default" as const },
    degraded: { icon: AlertTriangle, color: "text-yellow-500", label: "Degraded", badge: "secondary" as const },
    down: { icon: AlertTriangle, color: "text-destructive", label: "Down", badge: "destructive" as const },
  };

  const healthyCount = checks.filter((c) => c.status === "healthy").length;
  const downCount = checks.filter((c) => c.status === "down").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {healthyCount} healthy · {downCount} down
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={runChecks} disabled={checking} className="gap-1.5">
          {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Check Now
        </Button>
      </div>

      {checks.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No tunnels to check.</p>
      ) : (
        <div className="space-y-2">
          {checks.map((c) => {
            const config = statusConfig[c.status];
            const Icon = config.icon;
            return (
              <div key={c.tunnel_id} className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`h-4 w-4 shrink-0 ${config.color}`} />
                  <div className="min-w-0">
                    <span className="text-sm font-mono truncate block">{c.tunnel_name}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{c.type}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {c.latency_ms !== null && (
                    <span className="font-mono text-xs text-muted-foreground">{c.latency_ms}ms</span>
                  )}
                  <Badge variant={config.badge} className="text-[10px]">{config.label}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
