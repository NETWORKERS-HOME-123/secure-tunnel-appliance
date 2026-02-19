import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { WebhookDeliveryLog } from "@/components/WebhookDeliveryLog";
import { Loader2, Plus, Trash2, Globe, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils-format";
import { z } from "zod";

const urlSchema = z.string().url("Must be a valid URL").startsWith("https://", "Must use HTTPS");

const EVENTS = [
  { value: "tunnel.created", label: "Tunnel Created" },
  { value: "tunnel.deleted", label: "Tunnel Deleted" },
  { value: "tunnel.online", label: "Tunnel Online" },
  { value: "tunnel.offline", label: "Tunnel Offline" },
];

interface WebhookEntry {
  id: string;
  name: string;
  url: string;
  events: string[];
  secret: string | null;
  active: boolean;
  last_triggered_at: string | null;
  failure_count: number;
  created_at: string;
}

export function WebhookManager() {
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<WebhookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchWebhooks();
  }, [user]);

  const fetchWebhooks = async () => {
    try {
      const data = await api.webhooks.list();
      setWebhooks(data ?? []);
    } catch {}
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    const urlResult = urlSchema.safeParse(url);
    if (!urlResult.success) { toast.error(urlResult.error.errors[0].message); return; }
    if (selectedEvents.length === 0) { toast.error("Select at least one event"); return; }

    setCreating(true);
    try {
      await api.webhooks.create(name.trim(), url.trim(), selectedEvents);
      toast.success("Webhook created");
      setName(""); setUrl(""); setSelectedEvents([]); setShowCreate(false);
      fetchWebhooks();
    } catch (e: any) {
      toast.error(e.message || "Failed to create webhook");
    }
    setCreating(false);
  };

  const handleToggle = async (id: string, active: boolean) => {
    try {
      await api.webhooks.update(id, { active });
      setWebhooks((prev) => prev.map((w) => (w.id === id ? { ...w, active } : w)));
      toast.success(active ? "Webhook enabled" : "Webhook disabled");
    } catch {
      toast.error("Failed to update webhook");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.webhooks.delete(id);
      toast.success("Webhook deleted");
      fetchWebhooks();
    } catch {
      toast.error("Failed to delete webhook");
    }
  };

  const toggleEvent = (event: string) => {
    setSelectedEvents((prev) => prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]);
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{webhooks.length} webhook{webhooks.length !== 1 ? "s" : ""}</p>
        <Button variant="outline" size="sm" onClick={() => setShowCreate(!showCreate)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Webhook
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Slack Alert" maxLength={50} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">URL (HTTPS)</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.example.com/..." className="font-mono text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Events</Label>
            <div className="grid grid-cols-2 gap-2">
              {EVENTS.map((ev) => (
                <label key={ev.value} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={selectedEvents.includes(ev.value)} onCheckedChange={() => toggleEvent(ev.value)} />
                  <span className="text-xs">{ev.label}</span>
                </label>
              ))}
            </div>
          </div>
          <Button onClick={handleCreate} disabled={creating} size="sm">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Webhook"}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {webhooks.map((w) => (
          <div key={w.id} className="rounded-lg border border-border bg-muted/50 px-3 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium truncate">{w.name}</span>
                {w.failure_count > 0 && (
                  <Badge variant="destructive" className="text-[10px] gap-1">
                    <AlertCircle className="h-2.5 w-2.5" /> {w.failure_count} failures
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedWebhook(expandedWebhook === w.id ? null : w.id)}>
                  {expandedWebhook === w.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </Button>
                <Switch checked={w.active} onCheckedChange={(active) => handleToggle(w.id, active)} />
                <ConfirmDeleteDialog title="Delete Webhook" description={`Delete "${w.name}"?`} onConfirm={() => handleDelete(w.id)}>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </ConfirmDeleteDialog>
              </div>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground truncate">{w.url}</p>
            <div className="flex flex-wrap gap-1">
              {w.events.map((ev) => (
                <Badge key={ev} variant="outline" className="text-[10px] font-mono">{ev}</Badge>
              ))}
            </div>
            {expandedWebhook === w.id && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs font-semibold mb-2">Delivery History</p>
                <WebhookDeliveryLog webhookId={w.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
