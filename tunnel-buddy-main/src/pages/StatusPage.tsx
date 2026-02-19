import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils-format";
import { PublicLayout } from "@/components/PublicLayout";

interface Incident {
  id: string;
  title: string;
  description: string | null;
  status: string;
  severity: string;
  affected_component: string;
  created_at: string;
  resolved_at: string | null;
}

const COMPONENTS = [
  { name: "Cloud Relay", key: "relay" },
  { name: "Dashboard", key: "dashboard" },
  { name: "API", key: "api" },
  { name: "Authentication", key: "auth" },
];

const severityColors: Record<string, string> = {
  minor: "bg-tunnel-tcp/20 text-tunnel-tcp",
  major: "bg-destructive/20 text-destructive",
  critical: "bg-destructive text-destructive-foreground",
};

const statusIcons: Record<string, typeof CheckCircle2> = {
  investigating: AlertTriangle,
  identified: AlertTriangle,
  monitoring: Clock,
  resolved: CheckCircle2,
};

export default function StatusPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const data = await api.status.incidents();
        setIncidents(data ?? []);
      } catch {}
      setLoading(false);
    };
    fetchIncidents();

    // Poll every 30 seconds for updates
    const interval = setInterval(fetchIncidents, 30000);
    return () => clearInterval(interval);
  }, []);

  const activeIncidents = incidents.filter((i) => i.status !== "resolved");
  const resolvedIncidents = incidents.filter((i) => i.status === "resolved").slice(0, 10);
  const allOperational = activeIncidents.length === 0;

  const getComponentStatus = (key: string) => {
    return activeIncidents.some((i) => i.affected_component === key) ? "degraded" : "operational";
  };

  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-6 py-10 space-y-8">
        {/* Overall status */}
        <div className={`rounded-xl border p-6 text-center ${allOperational ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
          {allOperational ? (
            <>
              <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-3" />
              <h1 className="text-2xl font-bold">All Systems Operational</h1>
              <p className="text-sm text-muted-foreground mt-1">No active incidents</p>
            </>
          ) : (
            <>
              <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
              <h1 className="text-2xl font-bold">Active Incidents</h1>
              <p className="text-sm text-muted-foreground mt-1">{activeIncidents.length} ongoing incident{activeIncidents.length !== 1 ? "s" : ""}</p>
            </>
          )}
        </div>

        {/* Component status */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Components</h2>
          {COMPONENTS.map((comp) => {
            const status = getComponentStatus(comp.key);
            return (
              <div key={comp.key} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
                <span className="text-sm">{comp.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${status === "operational" ? "bg-tunnel-online" : "bg-destructive"}`} />
                  <span className={`text-xs font-mono ${status === "operational" ? "text-tunnel-online" : "text-destructive"}`}>
                    {status}
                  </span>
                </div>
              </div>
            );
          })}
        </section>

        {/* Active incidents */}
        {activeIncidents.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Active Incidents</h2>
            {activeIncidents.map((inc) => {
              const Icon = statusIcons[inc.status] || AlertTriangle;
              return (
                <div key={inc.id} className="rounded-lg border border-border bg-card p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-destructive" />
                    <span className="font-medium text-sm">{inc.title}</span>
                    <Badge className={`text-[10px] ${severityColors[inc.severity] || ""}`}>{inc.severity}</Badge>
                    <Badge variant="outline" className="text-[10px]">{inc.status}</Badge>
                  </div>
                  {inc.description && <p className="text-xs text-muted-foreground">{inc.description}</p>}
                  <p className="text-xs text-muted-foreground">Started {formatRelativeTime(inc.created_at)}</p>
                </div>
              );
            })}
          </section>
        )}

        {/* Resolved incidents */}
        {resolvedIncidents.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Recent Resolved Incidents</h2>
            {resolvedIncidents.map((inc) => (
              <div key={inc.id} className="rounded-lg border border-border bg-muted/30 p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-tunnel-online" />
                  <span className="text-sm">{inc.title}</span>
                  <Badge className={`text-[10px] ${severityColors[inc.severity] || ""}`}>{inc.severity}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatRelativeTime(inc.created_at)} — resolved {inc.resolved_at ? formatRelativeTime(inc.resolved_at) : ""}
                </p>
              </div>
            ))}
          </section>
        )}

        <div className="text-center text-xs text-muted-foreground pt-8 border-t border-border">
          <p>Powered by UltraSlim • Updated in real-time</p>
        </div>
      </div>
    </PublicLayout>
  );
}
