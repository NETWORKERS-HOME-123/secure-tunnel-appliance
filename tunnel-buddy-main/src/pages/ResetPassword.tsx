import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Zap, Loader2 } from "lucide-react";
import { z } from "zod";
import { PublicLayout } from "@/components/PublicLayout";

const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(128);

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [resetToken, setResetToken] = useState("");

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") || "";

    if (hash.includes("type=recovery") || token) {
      setIsRecovery(true);
      setResetToken(token);
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = passwordSchema.safeParse(password);
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await api.password.resetWithToken(resetToken, password);
      toast.success("Password updated successfully");
      navigate("/auth", { replace: true });
    } catch (e: any) {
      toast.error(e.message || "Failed to reset password");
    }
    setLoading(false);
  };

  if (!isRecovery) {
    return (
      <PublicLayout>
        <div className="flex-1 flex items-center justify-center p-4 grid-bg">
          <div className="w-full max-w-sm space-y-8 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                <Zap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-mono text-lg font-bold tracking-tight">UltraSlim</span>
            </div>
            <div className="rounded-lg border border-border bg-card p-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                Invalid or expired reset link. Please request a new password reset.
              </p>
              <Button onClick={() => navigate("/auth")} variant="outline" className="w-full">
                Back to Sign In
              </Button>
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="flex-1 flex items-center justify-center p-4 grid-bg">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                <Zap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-mono text-lg font-bold tracking-tight">UltraSlim</span>
            </div>
            <p className="text-sm text-muted-foreground">Set your new password</p>
          </div>

          <form onSubmit={handleReset} className="space-y-4 rounded-lg border border-border bg-card p-6">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                maxLength={128}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                maxLength={128}
              />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </form>
        </div>
      </div>
    </PublicLayout>
  );
}
