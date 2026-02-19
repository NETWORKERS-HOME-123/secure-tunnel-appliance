import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, Users, UserPlus, Trash2, Crown } from "lucide-react";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

interface Team {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  created_at: string;
}

interface Member {
  id: string;
  team_id: string;
  user_id: string;
  role: string;
  invited_email: string | null;
  status: string;
  created_at: string;
}

export function TeamManager() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitingTeamId, setInvitingTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchTeams();
  }, [user]);

  const fetchTeams = async () => {
    try {
      const data = await api.teams.list();
      const teamsData = data?.teams ?? data ?? [];
      setTeams(teamsData);
      const allMembers: Member[] = [];
      for (const team of teamsData) {
        try {
          const m = await api.teams.members(team.id);
          allMembers.push(...(m ?? []));
        } catch {}
      }
      setMembers(allMembers);
    } catch {}
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!teamName.trim()) {
      toast.error("Team name is required");
      return;
    }
    const slug = teamName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    setCreating(true);
    try {
      await api.teams.create(teamName.trim(), slug);
      toast.success("Team created");
      setTeamName("");
      setShowCreate(false);
      await fetchTeams();
    } catch (e: any) {
      toast.error(e.message?.includes("duplicate") ? "Team slug already taken" : "Failed to create team");
    }
    setCreating(false);
  };

  const handleInvite = async (teamId: string) => {
    if (!inviteEmail.trim()) {
      toast.error("Email is required");
      return;
    }
    try {
      await api.teams.invite(teamId, inviteEmail.trim());
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInvitingTeamId(null);
      await fetchTeams();
    } catch {
      toast.error("Failed to invite");
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    try {
      await api.teams.delete(teamId);
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      toast.success("Team deleted");
    } catch {
      toast.error("Failed to delete team");
    }
  };

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{teams.length} team{teams.length !== 1 ? "s" : ""}</p>
        <Button variant="outline" size="sm" onClick={() => setShowCreate(!showCreate)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Team
        </Button>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Team Name</Label>
            <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="My Team" maxLength={50} className="text-sm" />
          </div>
          <Button onClick={handleCreate} disabled={creating} size="sm">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Team"}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {teams.map((team) => {
          const teamMembers = members.filter((m) => m.team_id === team.id);
          return (
            <div key={team.id} className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{team.name}</span>
                  <Badge variant="outline" className="text-[10px] font-mono">{team.slug}</Badge>
                  {team.owner_id === user?.id && (
                    <Badge className="text-[10px] gap-1 bg-primary/10 text-primary">
                      <Crown className="h-2.5 w-2.5" /> Owner
                    </Badge>
                  )}
                </div>
                {team.owner_id === user?.id && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setInvitingTeamId(invitingTeamId === team.id ? null : team.id)}>
                      <UserPlus className="h-3.5 w-3.5" /> Invite
                    </Button>
                    <ConfirmDeleteDialog title="Delete Team" description={`Delete "${team.name}"?`} onConfirm={() => handleDeleteTeam(team.id)}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </ConfirmDeleteDialog>
                  </div>
                )}
              </div>

              {invitingTeamId === team.id && (
                <div className="flex gap-2">
                  <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="email@example.com" className="text-sm h-8" />
                  <Button size="sm" className="h-8" onClick={() => handleInvite(team.id)}>Send</Button>
                </div>
              )}

              <div className="space-y-1">
                {teamMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-2 py-1 rounded bg-muted/30 text-xs">
                    <span className="font-mono">{m.invited_email || m.user_id.slice(0, 8)}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{m.role}</Badge>
                      <Badge variant={m.status === "active" ? "default" : "secondary"} className="text-[10px]">{m.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
