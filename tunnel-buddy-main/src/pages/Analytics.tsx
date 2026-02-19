import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useTunnels } from "@/hooks/useTunnels";
import { formatBytes } from "@/lib/utils-format";
import { RequestInspector } from "@/components/RequestInspector";
import { ConnectionLogExport } from "@/components/ConnectionLogExport";
import { Loader2, BarChart3, Eye } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

interface ConnectionLog {
  id: string;
  tunnel_id: string;
  method: string | null;
  path: string | null;
  status_code: number | null;
  latency_ms: number | null;
  bytes_transferred: number;
  created_at: string;
}

export default function Analytics() {
  const { user } = useAuth();
  const { tunnels } = useTunnels();
  const [logs, setLogs] = useState<ConnectionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchLogs = async () => {
      try {
        const data = await api.analytics.connectionLogs(undefined, 500);
        setLogs(data ?? []);
      } catch {}
      setLoading(false);
    };
    fetchLogs();
  }, [user]);

  const totalBytesIn = tunnels.reduce((acc, t: any) => acc + t.bytes_in, 0);
  const totalBytesOut = tunnels.reduce((acc, t: any) => acc + t.bytes_out, 0);
  const onlineCount = tunnels.filter((t: any) => t.status === "online").length;
  const offlineCount = tunnels.filter((t: any) => t.status === "offline").length;

  const statusData = [
    { name: "Online", value: onlineCount, color: "hsl(152, 76%, 52%)" },
    { name: "Offline", value: offlineCount, color: "hsl(0, 72%, 55%)" },
  ].filter((d) => d.value > 0);

  const httpCount = tunnels.filter((t: any) => t.type === "http").length;
  const tcpCount = tunnels.filter((t: any) => t.type === "tcp").length;
  const typeData = [
    { name: "HTTP", value: httpCount, color: "hsl(210, 80%, 60%)" },
    { name: "TCP", value: tcpCount, color: "hsl(30, 80%, 60%)" },
  ].filter((d) => d.value > 0);

  const bandwidthData = tunnels.map((t: any) => ({
    name: t.tunnel_id,
    in: t.bytes_in,
    out: t.bytes_out,
  }));

  return (
    <DashboardLayout>
      <div className="container max-w-5xl py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Analytics</h1>
          </div>
          <ConnectionLogExport />
        </div>

        {/* Stats overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Tunnels", value: tunnels.length },
            { label: "Active", value: onlineCount },
            { label: "Bandwidth In", value: formatBytes(totalBytesIn) },
            { label: "Bandwidth Out", value: formatBytes(totalBytesOut) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border bg-card p-4 space-y-1">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="text-xl font-bold font-mono">{stat.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview" className="gap-1.5 text-xs"><BarChart3 className="h-3.5 w-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="inspector" className="gap-1.5 text-xs"><Eye className="h-3.5 w-3.5" /> Request Inspector</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold">Bandwidth by Tunnel</h3>
                {bandwidthData.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center">No tunnels</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={bandwidthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 14%, 18%)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(215, 12%, 50%)" }} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(215, 12%, 50%)" }} tickFormatter={(v) => formatBytes(v)} />
                      <Tooltip contentStyle={{ background: "hsl(220, 18%, 10%)", border: "1px solid hsl(220, 14%, 18%)", borderRadius: 8, fontSize: 12 }} formatter={(value: number) => formatBytes(value)} />
                      <Area type="monotone" dataKey="in" stackId="1" stroke="hsl(152, 76%, 52%)" fill="hsl(152, 76%, 52%)" fillOpacity={0.3} name="In" />
                      <Area type="monotone" dataKey="out" stackId="1" stroke="hsl(185, 70%, 50%)" fill="hsl(185, 70%, 50%)" fillOpacity={0.3} name="Out" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <h3 className="text-sm font-semibold">Tunnel Breakdown</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-2">By Status</p>
                    {statusData.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-8">No data</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={120}>
                        <PieChart>
                          <Pie data={statusData} dataKey="value" cx="50%" cy="50%" outerRadius={45} innerRadius={25}>
                            {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: "hsl(220, 18%, 10%)", border: "1px solid hsl(220, 14%, 18%)", borderRadius: 8, fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                    <div className="flex justify-center gap-3 text-xs">
                      {statusData.map((d) => (
                        <span key={d.name} className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                          {d.name} ({d.value})
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-2">By Type</p>
                    {typeData.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-8">No data</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={120}>
                        <PieChart>
                          <Pie data={typeData} dataKey="value" cx="50%" cy="50%" outerRadius={45} innerRadius={25}>
                            {typeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip contentStyle={{ background: "hsl(220, 18%, 10%)", border: "1px solid hsl(220, 14%, 18%)", borderRadius: 8, fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                    <div className="flex justify-center gap-3 text-xs">
                      {typeData.map((d) => (
                        <span key={d.name} className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                          {d.name} ({d.value})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <section className="rounded-lg border border-border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold">Recent Connections</h3>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : logs.length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">No connection logs yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 pr-3">Method</th>
                        <th className="text-left py-2 pr-3">Path</th>
                        <th className="text-left py-2 pr-3">Status</th>
                        <th className="text-left py-2 pr-3">Latency</th>
                        <th className="text-left py-2">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.slice(0, 50).map((log) => (
                        <tr key={log.id} className="border-b border-border/50">
                          <td className="py-1.5 pr-3 text-primary">{log.method || "—"}</td>
                          <td className="py-1.5 pr-3 text-foreground max-w-[200px] truncate">{log.path || "/"}</td>
                          <td className="py-1.5 pr-3">
                            <span className={log.status_code && log.status_code < 400 ? "text-tunnel-online" : "text-tunnel-offline"}>
                              {log.status_code ?? "—"}
                            </span>
                          </td>
                          <td className="py-1.5 pr-3 text-muted-foreground">{log.latency_ms ? `${log.latency_ms}ms` : "—"}</td>
                          <td className="py-1.5 text-muted-foreground">{new Date(log.created_at).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="inspector">
            <section className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Request Inspector</h3>
              </div>
              <p className="text-xs text-muted-foreground">View and inspect individual HTTP requests through your tunnels.</p>
              <RequestInspector />
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
