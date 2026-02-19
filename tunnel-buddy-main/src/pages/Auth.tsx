import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Zap, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { z } from "zod";
import { PublicLayout } from "@/components/PublicLayout";

const emailSchema = z.string().trim().email("Invalid email address").max(255);
const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(128);

export default function Auth() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      toast.error(emailResult.error.errors[0].message);
      return;
    }

    if (mode === "forgot") {
      setLoading(true);
      try {
        await api.auth.forgotPassword(email);
        toast.success("If an account with that email exists, a reset link has been sent.");
      } catch (err: any) {
        toast.error(err.message);
      }
      setLoading(false);
      return;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      toast.error(passwordResult.error.errors[0].message);
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        await api.auth.login(email, password);
        toast.success("Signed in");
      } else {
        await api.auth.signup(email, password, displayName || email.split("@")[0]);
        toast.success("Account created successfully");
      }
      await refreshUser();
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err.message);
    }

    setLoading(false);
  };

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
            <p className="text-sm text-muted-foreground">
              {mode === "login" && "Sign in to your account"}
              {mode === "signup" && "Create a new account"}
              {mode === "forgot" && "Reset your password"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-6">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="your name"
                  className="font-mono"
                  maxLength={100}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="font-mono"
                required
                maxLength={255}
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "login" && (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-primary hover:text-glow transition-all"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
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
            )}
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" && "Sign In"}
              {mode === "signup" && "Sign Up"}
              {mode === "forgot" && "Send Reset Link"}
            </Button>
          </form>

          <div className="text-center text-sm text-muted-foreground space-y-1">
            {mode === "login" && (
              <p>
                Don't have an account?{" "}
                <button onClick={() => setMode("signup")} className="text-primary hover:text-glow transition-all font-medium">
                  Sign up
                </button>
              </p>
            )}
            {mode === "signup" && (
              <p>
                Already have an account?{" "}
                <button onClick={() => setMode("login")} className="text-primary hover:text-glow transition-all font-medium">
                  Sign in
                </button>
              </p>
            )}
            {mode === "forgot" && (
              <p>
                Remember your password?{" "}
                <button onClick={() => setMode("login")} className="text-primary hover:text-glow transition-all font-medium">
                  Sign in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
