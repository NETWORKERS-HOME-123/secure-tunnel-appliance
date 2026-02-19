import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Loader2, Key, Plus, Copy, Trash2, EyeOff } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils-format";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
}

export function ApiKeyManager() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchKeys();
  }, [user]);

  const fetchKeys = async () => {
    try {
      const data = await api.apiKeys.list();
      setKeys(data ?? []);
    } catch {}
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error("Key name is required");
      return;
    }
    setCreating(true);

    try {
      const result = await api.apiKeys.create(newKeyName.trim());
      setRevealedKey(result.key);
      toast.success("API key created — copy it now, it won't be shown again!");
      setNewKeyName("");
      setShowCreate(false);
      fetchKeys();
    } catch (e: any) {
      toast.error(e.message || "Failed to create key");
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.apiKeys.delete(id);
      toast.success("API key deleted");
      fetchKeys();
    } catch {
      toast.error("Failed to delete key");
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Copied to clipboard");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {revealedKey && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
          <p className="text-xs font-semibold text-primary">Your new API key (copy now!):</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted p-2 font-mono text-xs break-all">{revealedKey}</code>
            <Button variant="ghost" size="icon" onClick={() => copyKey(revealedKey)} className="shrink-0">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setRevealedKey(null)} className="text-xs">
            Dismiss
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{keys.length} key{keys.length !== 1 ? "s" : ""}</p>
        <Button variant="outline" size="sm" onClick={() => setShowCreate(!showCreate)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Key
        </Button>
      </div>

      {showCreate && (
        <div className="flex gap-2">
          <Input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g. CI/CD)"
            className="font-mono text-sm"
            maxLength={50}
          />
          <Button onClick={handleCreate} disabled={creating} className="shrink-0">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {keys.map((k) => (
          <div key={k.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Key className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium truncate">{k.name}</span>
                {k.revoked && <Badge variant="destructive" className="text-[10px]">revoked</Badge>}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="font-mono text-[10px] text-muted-foreground">{k.key_prefix}</span>
                <span className="text-[10px] text-muted-foreground">
                  Created {formatRelativeTime(k.created_at)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <ConfirmDeleteDialog
                title="Delete API Key"
                description={`Delete key "${k.name}"? This cannot be undone.`}
                onConfirm={() => handleDelete(k.id)}
              >
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </ConfirmDeleteDialog>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
