import { Zap, LogOut, Shield, Settings, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useRoles } from "@/hooks/useRoles";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function DashboardHeader() {
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const { isSuperAdmin } = useRoles();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-mono text-sm font-bold tracking-tight hidden sm:inline">
              UltraSlim
            </span>
          </button>
          <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground hidden sm:inline">
            v0.1
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {profile && (
            <span className="font-mono text-xs text-muted-foreground hidden md:inline mr-1">
              {profile.display_name}
            </span>
          )}
          <Button variant="ghost" size="icon" onClick={() => navigate("/analytics")} className="text-muted-foreground hover:text-primary" aria-label="Analytics">
            <BarChart3 className="h-4 w-4" />
          </Button>
          {isSuperAdmin && (
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="text-muted-foreground hover:text-primary" aria-label="Admin">
              <Shield className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} className="text-muted-foreground hover:text-primary" aria-label="Settings">
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-destructive" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
