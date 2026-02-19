import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useRoles } from "@/hooks/useRoles";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Trash2, ShieldPlus, ShieldMinus, ArrowLeft } from "lucide-react";
import { formatBytes } from "@/lib/utils-format";

interface AdminUser {
  id: string;
  email: string;
  display_name: string | null;
  roles: string[];
  created_at: string;
  last_sign_in_at: string | null;
}

interface AdminTunnel {
  id: string;
  user_id: string;
  tunnel_id: string;
  type: string;
  local_port: number;
  public_endpoint: string;
  status: string;
  bytes_in: number;
  bytes_out: number;
  connections: number;
  created_at: string;
}

export default function AdminPanel() {
  const { isSuperAdmin, loading: rolesLoading } = useRoles();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tunnels, setTunnels] = useState<AdminTunnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [usersData, tunnelsData] = await Promise.all([
        api.admin.getUsers(),
        api.admin.getAllTunnels(),
      ]);
      setUsers(usersData?.users ?? usersData ?? []);
      setTunnels(tunnelsData?.tunnels ?? tunnelsData ?? []);
    } catch {
      toast.error("Failed to load admin data");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (rolesLoading) return;
    if (!isSuperAdmin) {
      navigate("/", { replace: true });
      return;
    }
    fetchData();
  }, [isSuperAdmin, rolesLoading, navigate, fetchData]);

  const handleDeleteTunnel = async (tunnelId: string) => {
    setActionLoading(tunnelId);
    try {
      await api.admin.deleteTunnel(tunnelId);
      setTunnels((prev) => prev.filter((t) => t.id !== tunnelId));
      toast.success("Tunnel deleted");
    } catch (e: any) {
      toast.error(e.message);
    }
    setActionLoading(null);
  };

  const handleAssignRole = async (userId: string, role: string) => {
    setActionLoading(`assign-${userId}`);
    try {
      await api.admin.assignRole(userId, role);
      await fetchData();
      toast.success(`Role ${role} assigned`);
    } catch (e: any) {
      toast.error(e.message);
    }
    setActionLoading(null);
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    if (userId === user?.id && role === "superadmin") {
      toast.error("Cannot remove your own superadmin role");
      return;
    }
    setActionLoading(`remove-${userId}-${role}`);
    try {
      await api.admin.assignRole(userId, "user");
      await fetchData();
      toast.success(`Role ${role} removed`);
    } catch (e: any) {
      toast.error(e.message);
    }
    setActionLoading(null);
  };

  if (rolesLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const tunnelsByUser = new Map<string, AdminTunnel[]>();
  tunnels.forEach((t) => {
    const existing = tunnelsByUser.get(t.user_id) ?? [];
    existing.push(t);
    tunnelsByUser.set(t.user_id, existing);
  });

  return (
    <DashboardLayout>
      <div className="container max-w-6xl py-8 space-y-8">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <Badge variant="outline" className="border-primary text-primary font-mono text-xs">
            superadmin
          </Badge>
        </div>

        {/* Users Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Users ({users.length})</h2>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Tunnels</TableHead>
                  <TableHead>Last Sign In</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{u.display_name || "—"}</p>
                        <p className="font-mono text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(!u.roles || u.roles.length === 0) && (
                          <span className="text-xs text-muted-foreground">user</span>
                        )}
                        {u.roles?.map((role) => (
                          <Badge
                            key={role}
                            variant="secondary"
                            className="gap-1 font-mono text-xs cursor-pointer hover:bg-destructive/20"
                            onClick={() => handleRemoveRole(u.id, role)}
                          >
                            {role}
                            <ShieldMinus className="h-3 w-3" />
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">
                        {tunnelsByUser.get(u.id)?.length ?? 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {u.last_sign_in_at
                          ? new Date(u.last_sign_in_at).toLocaleDateString()
                          : "Never"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Select onValueChange={(role) => handleAssignRole(u.id, role)}>
                        <SelectTrigger className="w-[130px] h-8 text-xs">
                          <SelectValue placeholder="Add role..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">admin</SelectItem>
                          <SelectItem value="superadmin">superadmin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* All Tunnels Section */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">All Tunnels ({tunnels.length})</h2>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tunnel ID</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Traffic</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tunnels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No tunnels across the platform
                    </TableCell>
                  </TableRow>
                ) : (
                  tunnels.map((t) => {
                    const owner = users.find((u) => u.id === t.user_id);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.tunnel_id}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {owner?.email ?? t.user_id.slice(0, 8)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs uppercase">
                            {t.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs max-w-[200px] truncate">
                          {t.public_endpoint}
                        </TableCell>
                        <TableCell>
                          <span className={`flex items-center gap-1.5 text-xs font-mono ${t.status === "online" ? "text-tunnel-online" : "text-tunnel-offline"}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${t.status === "online" ? "bg-tunnel-online" : "bg-tunnel-offline"}`} />
                            {t.status}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          ↓{formatBytes(t.bytes_in)} ↑{formatBytes(t.bytes_out)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteTunnel(t.id)}
                            disabled={actionLoading === t.id}
                          >
                            {actionLoading === t.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
