import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useTunnels } from "@/hooks/useTunnels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Globe, Link2 } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

interface SubdomainClaim {
  id: string;
  subdomain: string;
  tunnel_id: string | null;
  verified: boolean;
  created_at: string;
}

export function SubdomainManager() {
  const { user } = useAuth();
  const { tunnels } = useTunnels();
  const [claims, setClaims] = useState<SubdomainClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [subdomain, setSubdomain] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchClaims = async () => {
      try {
        const data = await api.subdomains.list();
        setClaims(data ?? []);
      } catch {}
      setLoading(false);
    };
    fetchClaims();
  }, [user]);

  const handleClaim = async () => {
    const clean = subdomain.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (clean.length < 3) {
      toast.error("Subdomain must be at least 3 characters");
      return;
    }
    setCreating(true);
    try {
      await api.subdomains.claim(clean);
      toast.success(`${clean}.ultraslim.io claimed!`);
      setSubdomain("");
      setShowForm(false);
      const data = await api.subdomains.list();
      setClaims(data ?? []);
    } catch (e: any) {
      if (e.message?.includes("duplicate") || e.message?.includes("taken")) {
        toast.error("Subdomain already taken");
      } else {
        toast.error("Failed to claim subdomain");
      }
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.subdomains.delete(id);
      setClaims((prev) => prev.filter((c) => c.id !== id));
      toast.success("Subdomain released");
    } catch {
      toast.error("Failed to release subdomain");
    }
  };

  const handleLink = async (claimId: string, tunnelId: string) => {
    try {
      await api.subdomains.link(claimId, tunnelId === "none" ? null : tunnelId);
      setClaims((prev) => prev.map((c) => c.id === claimId ? { ...c, tunnel_id: tunnelId === "none" ? null : tunnelId } : c));
      toast.success("Subdomain linked");
    } catch {
      toast.error("Failed to link subdomain");
    }
  };

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{claims.length} subdomain{claims.length !== 1 ? "s" : ""}</p>
        <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Claim Subdomain
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Subdomain</Label>
            <div className="flex gap-2 items-center">
              <Input
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                placeholder="myapp"
                className="font-mono text-sm"
                maxLength={30}
              />
              <span className="text-sm text-muted-foreground font-mono shrink-0">.ultraslim.io</span>
            </div>
          </div>
          <Button onClick={handleClaim} disabled={creating} size="sm">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim"}
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {claims.map((c) => (
          <div key={c.id} className="rounded-lg border border-border bg-muted/50 px-3 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-sm font-medium">{c.subdomain}.ultraslim.io</span>
                <Badge variant={c.verified ? "default" : "outline"} className="text-[10px]">
                  {c.verified ? "Verified" : "Pending"}
                </Badge>
              </div>
              <ConfirmDeleteDialog title="Release Subdomain" description={`Release ${c.subdomain}.ultraslim.io?`} onConfirm={() => handleDelete(c.id)}>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </ConfirmDeleteDialog>
            </div>
            <div className="flex items-center gap-2">
              <Link2 className="h-3 w-3 text-muted-foreground" />
              <Select value={c.tunnel_id ?? "none"} onValueChange={(v) => handleLink(c.id, v)}>
                <SelectTrigger className="h-7 text-xs w-[200px]">
                  <SelectValue placeholder="Link to tunnel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not linked</SelectItem>
                  {tunnels.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.tunnel_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
