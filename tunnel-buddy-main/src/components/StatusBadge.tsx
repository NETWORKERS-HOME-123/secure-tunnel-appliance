import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "online" | "offline";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-mono font-medium",
        status === "online"
          ? "bg-tunnel-online/10 text-tunnel-online"
          : "bg-tunnel-offline/10 text-tunnel-offline"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "online"
            ? "bg-tunnel-online animate-pulse-glow"
            : "bg-tunnel-offline"
        )}
      />
      {status}
    </span>
  );
}
