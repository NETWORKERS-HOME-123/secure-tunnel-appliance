import { useProfile } from "@/hooks/useProfile";
import { useTunnels } from "@/hooks/useTunnels";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/utils-format";
import { Gauge, Wifi, ArrowDownToLine } from "lucide-react";

export function UsageQuota() {
  const { profile } = useProfile();
  const { tunnels } = useTunnels();

  const maxTunnels = profile?.max_tunnels ?? 5;
  const activeTunnels = tunnels.filter((t) => t.status === "online").length;
  const tunnelPercent = Math.min((activeTunnels / maxTunnels) * 100, 100);

  const totalBandwidth = tunnels.reduce((a, t) => a + t.bytes_in + t.bytes_out, 0);
  // Free tier: 1GB
  const maxBandwidth = 1_073_741_824;
  const bwPercent = Math.min((totalBandwidth / maxBandwidth) * 100, 100);

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Usage & Limits</h3>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <Wifi className="h-3 w-3" /> Active Tunnels
            </span>
            <span className="font-mono">
              {activeTunnels} / {maxTunnels}
            </span>
          </div>
          <Progress value={tunnelPercent} className="h-2" />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-muted-foreground">
              <ArrowDownToLine className="h-3 w-3" /> Bandwidth (this period)
            </span>
            <span className="font-mono">
              {formatBytes(totalBandwidth)} / {formatBytes(maxBandwidth)}
            </span>
          </div>
          <Progress value={bwPercent} className="h-2" />
        </div>
      </div>

      {(tunnelPercent >= 80 || bwPercent >= 80) && (
        <p className="text-xs text-destructive">
          You're approaching your plan limits. Consider upgrading.
        </p>
      )}
    </div>
  );
}
