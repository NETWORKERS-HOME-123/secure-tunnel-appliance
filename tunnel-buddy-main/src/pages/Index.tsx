import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TunnelCard } from "@/components/TunnelCard";
import { CreateTunnelDialog } from "@/components/CreateTunnelDialog";
import { AgentStatus } from "@/components/AgentStatus";
import { SetupGuide } from "@/components/SetupGuide";
import { TunnelFilters } from "@/components/TunnelFilters";
import { UsageQuota } from "@/components/UsageQuota";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { useTunnels } from "@/hooks/useTunnels";
import { useProfile } from "@/hooks/useProfile";
import { Activity, Loader2 } from "lucide-react";

const Index = () => {
  const { tunnels, loading, createTunnel, deleteTunnel } = useTunnels();
  const { profile } = useProfile();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    if (profile && !(profile as any).onboarding_completed) {
      setShowOnboarding(true);
    }
  }, [profile]);

  const filteredTunnels = useMemo(() => {
    return tunnels.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          t.tunnel_id.toLowerCase().includes(q) ||
          t.public_endpoint.toLowerCase().includes(q) ||
          String(t.local_port).includes(q)
        );
      }
      return true;
    });
  }, [tunnels, search, statusFilter, typeFilter]);

  const onlineCount = tunnels.filter((t) => t.status === "online").length;

  return (
    <DashboardLayout>
      {showOnboarding && <OnboardingWizard onComplete={() => setShowOnboarding(false)} />}
      <div className="container max-w-4xl py-8 space-y-6">
        <AgentStatus />

        <div className="grid gap-4 md:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold">Tunnels</h1>
                <span className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
                  <Activity className="h-3 w-3 text-tunnel-online" />
                  {onlineCount} active
                </span>
              </div>
              <CreateTunnelDialog onCreate={createTunnel} />
            </div>

            <TunnelFilters
              search={search} onSearchChange={setSearch}
              statusFilter={statusFilter} onStatusChange={setStatusFilter}
              typeFilter={typeFilter} onTypeChange={setTypeFilter}
            />

            <section className="space-y-3" aria-label="Tunnel list">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredTunnels.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    {tunnels.length === 0 ? "No tunnels yet. Create one to expose a local service." : "No tunnels match your filters."}
                  </p>
                </div>
              ) : (
                filteredTunnels.map((tunnel) => (
                  <TunnelCard key={tunnel.id} tunnel={tunnel} onDelete={deleteTunnel} />
                ))
              )}
            </section>
          </div>

          <aside className="space-y-4">
            <UsageQuota />
          </aside>
        </div>

        <SetupGuide />
      </div>
    </DashboardLayout>
  );
};

export default Index;
