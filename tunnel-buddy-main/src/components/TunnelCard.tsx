import { Copy, Trash2, ArrowDownToLine, ArrowUpFromLine, Link2, Clock } from "lucide-react";
import { formatBytes, formatRelativeTime } from "@/lib/utils-format";
import { StatusBadge } from "./StatusBadge";
import { TunnelTypeBadge } from "./TunnelTypeBadge";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { toast } from "sonner";
import type { Tunnel } from "@/hooks/useTunnels";

interface TunnelCardProps {
  tunnel: Tunnel;
  onDelete: (id: string) => void;
}

export function TunnelCard({ tunnel, onDelete }: TunnelCardProps) {
  const copyEndpoint = () => {
    navigator.clipboard.writeText(tunnel.public_endpoint);
    toast.success("Copied to clipboard");
  };

  return (
    <article className="group rounded-lg border border-border bg-card p-4 transition-all hover:border-glow hover:glow-primary">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <TunnelTypeBadge type={tunnel.type} />
            <StatusBadge status={tunnel.status} />
            <span className="font-mono text-xs text-muted-foreground">
              {tunnel.tunnel_id}
            </span>
            {tunnel.expires_at && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                expires {formatRelativeTime(tunnel.expires_at)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <button
              onClick={copyEndpoint}
              className="group/url flex items-center gap-1.5 truncate font-mono text-sm text-primary hover:text-glow transition-all"
              aria-label={`Copy endpoint ${tunnel.public_endpoint}`}
            >
              <span className="truncate">{tunnel.public_endpoint}</span>
              <Copy className="h-3 w-3 shrink-0 opacity-0 group-hover/url:opacity-100 transition-opacity" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-muted-foreground font-mono">
            <span className="flex items-center gap-1">
              <span className="text-secondary-foreground">localhost:</span>
              {tunnel.local_port}
            </span>
            <span className="flex items-center gap-1">
              <ArrowDownToLine className="h-3 w-3" />
              {formatBytes(tunnel.bytes_in)}
            </span>
            <span className="flex items-center gap-1">
              <ArrowUpFromLine className="h-3 w-3" />
              {formatBytes(tunnel.bytes_out)}
            </span>
            <span>{tunnel.connections} conn</span>
          </div>
        </div>

        <ConfirmDeleteDialog
          title="Delete tunnel?"
          description={`This will permanently remove tunnel ${tunnel.tunnel_id} and its public endpoint.`}
          onConfirm={() => onDelete(tunnel.id)}
        />
      </div>
    </article>
  );
}
