import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Shield, Smartphone, Copy, CheckCircle2 } from "lucide-react";

export function TwoFactorSetup() {
  const [enabled, setEnabled] = useState(false);
  const [step, setStep] = useState<"off" | "setup" | "verify">("off");
  const [code, setCode] = useState("");
  // In production, this would come from supabase.auth.mfa.enroll()
  const mockSecret = "JBSWY3DPEHPK3PXP";
  const mockQrUri = `otpauth://totp/UltraSlim:user@example.com?secret=${mockSecret}&issuer=UltraSlim`;

  const handleEnable = () => {
    setStep("setup");
  };

  const handleVerify = () => {
    if (code.length !== 6) {
      toast.error("Enter a 6-digit code");
      return;
    }
    // In production: supabase.auth.mfa.verify()
    setEnabled(true);
    setStep("off");
    toast.success("Two-factor authentication enabled!");
  };

  const handleDisable = () => {
    setEnabled(false);
    toast.success("Two-factor authentication disabled");
  };

  const copySecret = () => {
    navigator.clipboard.writeText(mockSecret);
    toast.success("Secret copied");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Two-Factor Authentication</span>
          {enabled ? (
            <Badge className="bg-primary/10 text-primary text-[10px]">Enabled</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Disabled</Badge>
          )}
        </div>
      </div>

      {!enabled && step === "off" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Add an extra layer of security with a TOTP authenticator app.
          </p>
          <Button variant="outline" size="sm" onClick={handleEnable} className="gap-1.5">
            <Smartphone className="h-3.5 w-3.5" /> Enable 2FA
          </Button>
        </div>
      )}

      {step === "setup" && (
        <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground">
            Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
          </p>
          <div className="flex items-center justify-center rounded-lg bg-white p-4 w-fit mx-auto">
            <div className="h-32 w-32 bg-muted/20 rounded border-2 border-dashed border-border flex items-center justify-center">
              <span className="text-xs text-muted-foreground text-center font-mono">QR Code<br />(TOTP)</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Manual entry key</Label>
            <div className="flex gap-2">
              <Input value={mockSecret} readOnly className="font-mono text-xs" />
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={copySecret}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <Button size="sm" onClick={() => setStep("verify")}>Continue</Button>
        </div>
      )}

      {step === "verify" && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground">Enter the 6-digit code from your authenticator app</p>
          <div className="space-y-1.5">
            <Label className="text-xs">Verification Code</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="font-mono text-center text-lg tracking-[0.5em] w-[180px]"
              maxLength={6}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setStep("setup")}>Back</Button>
            <Button size="sm" onClick={handleVerify} className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Verify & Enable
            </Button>
          </div>
        </div>
      )}

      {enabled && step === "off" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            Your account is protected with two-factor authentication.
          </p>
          <Button variant="destructive" size="sm" onClick={handleDisable}>
            Disable 2FA
          </Button>
        </div>
      )}
    </div>
  );
}
