import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Zap, ArrowRight, User, Terminal, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "Welcome", icon: Zap },
  { title: "Profile", icon: User },
  { title: "First Tunnel", icon: Terminal },
  { title: "All Set!", icon: CheckCircle2 },
];

interface OnboardingWizardProps {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      toast.error("Please enter a display name");
      return;
    }
    setSaving(true);
    try {
      await api.profile.update({ display_name: displayName.trim() });
    } catch {}
    setSaving(false);
    setStep(2);
  };

  const handleComplete = async () => {
    try {
      await api.profile.update({ display_name: displayName.trim() });
    } catch {}
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 rounded-xl border border-border bg-card p-8 space-y-6 glow-primary">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-mono transition-all",
                i === step ? "border-primary bg-primary text-primary-foreground" :
                i < step ? "border-primary/50 bg-primary/10 text-primary" :
                "border-border text-muted-foreground"
              )}>
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={cn("h-px w-8", i < step ? "bg-primary" : "bg-border")} />}
            </div>
          ))}
        </div>

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Zap className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-bold">Welcome to UltraSlim</h2>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Let's get you set up in under 2 minutes. You'll configure your profile and learn how to create your first tunnel.
            </p>
            <Button onClick={() => setStep(1)} className="gap-2">
              Let's Go <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 1: Profile */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-bold">Set up your profile</h2>
              <p className="text-sm text-muted-foreground mt-1">How should we address you?</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="onb-name">Display Name</Label>
              <Input
                id="onb-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="font-mono"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled className="font-mono opacity-60" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setStep(0)}>Back</Button>
              <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Continue <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: First Tunnel */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="text-xl font-bold">Create your first tunnel</h2>
              <p className="text-sm text-muted-foreground mt-1">Here's how to expose a local service</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/50 p-4 font-mono text-sm space-y-1">
              <p className="text-muted-foreground"><span className="text-primary">$</span> curl -fsSL https://get.ultraslim.io | sh</p>
              <p className="text-muted-foreground"><span className="text-primary">$</span> ultraslim login</p>
              <p className="text-muted-foreground"><span className="text-primary">$</span> ultraslim up --port 3000</p>
              <p className="text-primary mt-2">✓ https://myapp.ultraslim.io — live</p>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Or use the dashboard's "New Tunnel" button to create one manually.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)} className="gap-2">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: All Set */}
        {step === 3 && (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-bold">You're all set!</h2>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Your account is ready. Head to the dashboard to create tunnels, manage API keys, and explore analytics.
            </p>
            <Button onClick={handleComplete} className="gap-2">
              Go to Dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
