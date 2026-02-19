import { cn } from "@/lib/utils";

interface TunnelTypeBadgeProps {
  type: "http" | "tcp" | "ssh" | "rdp" | "udp" | "ws";
}

const typeStyles: Record<string, string> = {
  http: "bg-tunnel-http/10 text-tunnel-http",
  tcp: "bg-tunnel-tcp/10 text-tunnel-tcp",
  ssh: "bg-purple-500/10 text-purple-500",
  rdp: "bg-blue-500/10 text-blue-500",
  udp: "bg-orange-500/10 text-orange-500",
  ws: "bg-teal-500/10 text-teal-500",
};

export function TunnelTypeBadge({ type }: TunnelTypeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider",
        typeStyles[type] ?? typeStyles.tcp
      )}
    >
      {type}
    </span>
  );
}
