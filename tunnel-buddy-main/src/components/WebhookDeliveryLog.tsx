import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, RotateCcw, ChevronDown } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils-format";

interface Delivery {
  id: string;
  webhook_id: string;
  event: string;
  status_code: number | null;
  duration_ms: number | null;
  error: string | null;
  response_body: string | null;
  created_at: string;
}

interface WebhookDeliveryLogProps {
  webhookId: string;
}

export function WebhookDeliveryLog({ webhookId }: WebhookDeliveryLogProps) {
  const { user } = useAuth();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const fetchDeliveries = async () => {
    try {
      const data = await api.webhookDeliveries.list(webhookId);
      setDeliveries(data ?? []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchDeliveries();
  }, [user, webhookId]);

  const handleRetry = async (delivery: Delivery) => {
    setRetrying(delivery.id);
    try {
      await api.webhookDeliveries.retry(webhookId, delivery.id);
      toast.success("Retry queued");
      fetchDeliveries();
    } catch {
      toast.error("Failed to queue retry");
    }
    setRetrying(null);
  };

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;

  if (deliveries.length === 0) {
    return <p className="text-xs text-muted-foreground">No deliveries yet</p>;
  }

  const visible = showAll ? deliveries : deliveries.slice(0, 10);
  const isFailed = (d: Delivery) => !d.status_code || d.status_code >= 400;

  return (
    <div className="space-y-1">
      <div className="space-y-1 max-h-60 overflow-y-auto">
        {visible.map((d) => (
          <div key={d.id} className="rounded-md bg-muted/30 px-2 py-1.5 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                {isFailed(d) ? (
                  <XCircle className="h-3 w-3 text-destructive shrink-0" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 text-tunnel-online shrink-0" />
                )}
                <Badge variant="outline" className="text-[10px] font-mono">{d.event}</Badge>
                <span className="font-mono text-muted-foreground">
                  {d.status_code ?? "ERR"} • {d.duration_ms ? `${d.duration_ms}ms` : "—"}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-muted-foreground">{formatRelativeTime(d.created_at)}</span>
                {isFailed(d) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    disabled={retrying === d.id}
                    onClick={() => handleRetry(d)}
                    title="Retry delivery"
                  >
                    {retrying === d.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                >
                  <ChevronDown className={`h-3 w-3 transition-transform ${expandedId === d.id ? "rotate-180" : ""}`} />
                </Button>
              </div>
            </div>
            {expandedId === d.id && (
              <div className="pl-5 space-y-0.5 text-[10px] text-muted-foreground font-mono">
                {d.error && <p className="text-destructive">Error: {d.error}</p>}
                {d.response_body && (
                  <p className="truncate max-w-sm" title={d.response_body}>
                    Response: {d.response_body}
                  </p>
                )}
                <p>ID: {d.id}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      {deliveries.length > 10 && !showAll && (
        <Button variant="ghost" size="sm" className="w-full text-xs h-6" onClick={() => setShowAll(true)}>
          Show all {deliveries.length} deliveries
        </Button>
      )}
    </div>
  );
}
