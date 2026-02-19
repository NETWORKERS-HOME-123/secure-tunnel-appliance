import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Monitor, Smartphone, LogOut } from "lucide-react";

export function SessionManager() {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOutAll = async () => {
    setSigningOut(true);
    try {
      await api.sessions.signOutAll();
      toast.success("Signed out from all devices");
      signOut();
    } catch (e: any) {
      toast.error(e.message || "Failed to sign out");
    }
    setSigningOut(false);
  };

  const handleSignOutOthers = async () => {
    setSigningOut(true);
    try {
      await api.sessions.signOutOthers();
      toast.success("Other sessions signed out");
    } catch (e: any) {
      toast.error(e.message || "Failed to sign out others");
    }
    setSigningOut(false);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/50 px-3 py-3">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-primary" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Current Session</span>
              <Badge variant="outline" className="text-[10px]">Active</Badge>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
              {user?.email}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOutOthers}
          disabled={signingOut}
          className="gap-1.5"
        >
          {signingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
          Sign out other devices
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleSignOutAll}
          disabled={signingOut}
          className="gap-1.5"
        >
          {signingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
          Sign out everywhere
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        "Sign out other devices" keeps your current session active while ending all others.
        "Sign out everywhere" ends all sessions including this one.
      </p>
    </div>
  );
}
