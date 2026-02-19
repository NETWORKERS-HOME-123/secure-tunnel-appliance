import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ApiKeyManager } from "@/components/ApiKeyManager";
import { WebhookManager } from "@/components/WebhookManager";
import { ExportImportConfig } from "@/components/ExportImportConfig";
import { SessionManager } from "@/components/SessionManager";
import { TunnelHealthChecks } from "@/components/TunnelHealthChecks";
import { TwoFactorSetup } from "@/components/TwoFactorSetup";
import { SubdomainManager } from "@/components/SubdomainManager";
import { TeamManager } from "@/components/TeamManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, User, Lock, History, Key, Webhook, Download, HeartPulse, Monitor, Globe, Users } from "lucide-react";
import { z } from "zod";
import { formatRelativeTime } from "@/lib/utils-format";

const displayNameSchema = z.string().trim().min(1, "Name is required").max(100);
const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(128);

interface AuditLogEntry {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();

  const [displayName, setDisplayName] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    if (profile) setDisplayName(profile.display_name || "");
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    const fetchLogs = async () => {
      try {
        const data = await api.auditLogs.list(20);
        setAuditLogs(data ?? []);
      } catch {}
      setLogsLoading(false);
    };
    fetchLogs();
  }, [user]);

  const handleUpdateName = async () => {
    const result = displayNameSchema.safeParse(displayName);
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }
    setSavingName(true);
    try {
      await api.profile.update({ display_name: displayName.trim() });
      toast.success("Display name updated");
    } catch {
      toast.error("Failed to update name");
    }
    setSavingName(false);
  };

  const handleChangePassword = async () => {
    const result = passwordSchema.safeParse(newPassword);
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSavingPassword(true);
    try {
      await api.password.change(newPassword);
      toast.success("Password updated");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast.error(e.message || "Failed to update password");
    }
    setSavingPassword(false);
  };

  return (
    <DashboardLayout>
      <div className="container max-w-3xl py-8 space-y-6">
        <h1 className="text-xl font-bold">Settings</h1>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 sm:grid-cols-8 h-auto">
            <TabsTrigger value="profile" className="gap-1.5 text-xs"><User className="h-3.5 w-3.5" /> Profile</TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5 text-xs"><Lock className="h-3.5 w-3.5" /> Security</TabsTrigger>
            <TabsTrigger value="api-keys" className="gap-1.5 text-xs"><Key className="h-3.5 w-3.5" /> API Keys</TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-1.5 text-xs"><Webhook className="h-3.5 w-3.5" /> Webhooks</TabsTrigger>
            <TabsTrigger value="subdomains" className="gap-1.5 text-xs"><Globe className="h-3.5 w-3.5" /> Domains</TabsTrigger>
            <TabsTrigger value="teams" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Teams</TabsTrigger>
            <TabsTrigger value="health" className="gap-1.5 text-xs"><HeartPulse className="h-3.5 w-3.5" /> Health</TabsTrigger>
            <TabsTrigger value="config" className="gap-1.5 text-xs"><Download className="h-3.5 w-3.5" /> Config</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-6">
            <section className="rounded-lg border border-border bg-card p-6 space-y-4">
              <h2 className="text-sm font-semibold">Profile</h2>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={user?.email ?? ""} disabled className="font-mono opacity-60" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="font-mono"
                    maxLength={100}
                  />
                  <Button onClick={handleUpdateName} disabled={savingName} className="shrink-0">
                    {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </div>
            </section>

            {/* Activity Log */}
            <section className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Activity Log</h2>
              </div>
              {logsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : auditLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground">No activity yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs text-primary">{log.action}</span>
                        {log.target_id && (
                          <span className="font-mono text-xs text-muted-foreground truncate">
                            {log.target_id.slice(0, 8)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatRelativeTime(log.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-6">
            <section className="rounded-lg border border-border bg-card p-6 space-y-4">
              <h2 className="text-sm font-semibold">Change Password</h2>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" minLength={6} maxLength={128} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword">Confirm New Password</Label>
                <Input id="confirmNewPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" minLength={6} maxLength={128} />
              </div>
              <Button onClick={handleChangePassword} disabled={savingPassword}>
                {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
              </Button>
            </section>

            <section className="rounded-lg border border-border bg-card p-6 space-y-4">
              <TwoFactorSetup />
            </section>

            <section className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Sessions</h2>
              </div>
              <SessionManager />
            </section>

            <section className="rounded-lg border border-destructive/30 bg-card p-6 space-y-4">
              <h2 className="text-sm font-semibold text-destructive">Danger Zone</h2>
              <p className="text-xs text-muted-foreground">Sign out from this device.</p>
              <Button variant="destructive" onClick={signOut}>Sign Out</Button>
            </section>
          </TabsContent>

          {/* API Keys Tab */}
          <TabsContent value="api-keys">
            <section className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">API Keys</h2>
              </div>
              <p className="text-xs text-muted-foreground">Generate API keys for programmatic access to the tunnel control plane.</p>
              <ApiKeyManager />
            </section>
          </TabsContent>

          {/* Webhooks Tab */}
          <TabsContent value="webhooks">
            <section className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Webhooks</h2>
              </div>
              <p className="text-xs text-muted-foreground">Receive HTTP POST notifications when tunnel events occur.</p>
              <WebhookManager />
            </section>
          </TabsContent>

          {/* Subdomains Tab */}
          <TabsContent value="subdomains">
            <section className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Custom Subdomains</h2>
              </div>
              <p className="text-xs text-muted-foreground">Claim a custom subdomain like <code className="text-primary">myapp.ultraslim.io</code> for your tunnels.</p>
              <SubdomainManager />
            </section>
          </TabsContent>

          {/* Teams Tab */}
          <TabsContent value="teams">
            <section className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Team Workspaces</h2>
              </div>
              <p className="text-xs text-muted-foreground">Create teams to share tunnels and collaborate with your colleagues.</p>
              <TeamManager />
            </section>
          </TabsContent>

          {/* Health Tab */}
          <TabsContent value="health">
            <section className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <HeartPulse className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Tunnel Health Checks</h2>
              </div>
              <p className="text-xs text-muted-foreground">Monitor the health and latency of your active tunnels.</p>
              <TunnelHealthChecks />
            </section>
          </TabsContent>

          {/* Config Tab */}
          <TabsContent value="config">
            <section className="rounded-lg border border-border bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Export / Import</h2>
              </div>
              <ExportImportConfig />
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
