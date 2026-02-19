import { useState } from "react";
import { Plus, Globe, Database, Terminal, Monitor, Radio, Wifi } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface CreateTunnelDialogProps {
  onCreate: (type: "http" | "tcp" | "ssh" | "rdp" | "udp" | "ws", port: number, expiresInHours?: number) => Promise<void>;
}

export function CreateTunnelDialog({ onCreate }: CreateTunnelDialogProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"http" | "tcp" | "ssh" | "rdp" | "udp" | "ws">("http");
  const defaultPorts: Record<string, string> = { http: "3000", tcp: "5432", ssh: "22", rdp: "3389", udp: "5000", ws: "8080" };
  const portHints: Record<string, string> = { http: "typical for web servers", tcp: "typical for databases", ssh: "typical for SSH daemons", rdp: "typical for Remote Desktop", udp: "typical for game/media servers", ws: "typical for WebSocket servers" };
  const [port, setPort] = useState(defaultPorts.http);
  const [expiry, setExpiry] = useState("0");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const portNum = parseInt(port);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      toast.error("Invalid port number");
      return;
    }

    setCreating(true);
    const expiryHours = parseInt(expiry);
    await onCreate(type, portNum, expiryHours || undefined);
    setCreating(false);
    setOpen(false);
    setType("http");
    setPort(defaultPorts.http);
    setExpiry("0");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Tunnel</span>
          <span className="sm:hidden">New</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Tunnel</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Type</Label>
            <TooltipProvider delayDuration={200}>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: "http", label: "HTTP", desc: "Web traffic", Icon: Globe, tip: "Expose local web apps, APIs, or webhooks.\nultraslim http 3000" },
                  { value: "tcp", label: "TCP", desc: "Database / raw", Icon: Database, tip: "Forward database or custom TCP connections.\nultraslim tcp 5432" },
                  { value: "ssh", label: "SSH", desc: "Secure shell", Icon: Terminal, tip: "Remote terminal access to your machine.\nultraslim ssh 22" },
                  { value: "rdp", label: "RDP", desc: "Remote desktop", Icon: Monitor, tip: "Access Windows desktop remotely.\nultraslim rdp 3389" },
                  { value: "udp", label: "UDP", desc: "Game / media", Icon: Radio, tip: "Stream games, VoIP, or real-time media.\nultraslim udp 5000" },
                  { value: "ws", label: "WS", desc: "WebSocket", Icon: Wifi, tip: "Expose WebSocket servers for real-time apps.\nultraslim ws 8080" },
                ] as const).map((t) => (
                  <Tooltip key={t.value}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => { setType(t.value); setPort(defaultPorts[t.value]); }}
                        className={`flex flex-col items-center rounded-md border px-2 py-2.5 text-sm transition-all ${
                          type === t.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <t.Icon className="h-4 w-4 mb-1" />
                        <span className="font-mono font-bold uppercase text-xs">{t.label}</span>
                        <span className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[220px] text-xs whitespace-pre-line">
                      {t.tip.split("\n").map((line, i) =>
                        i === t.tip.split("\n").length - 1 ? (
                          <code key={i} className="block mt-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{line}</code>
                        ) : (
                          <span key={i}>{line}</span>
                        )
                      )}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </div>
          <div className="space-y-2">
            <Label htmlFor="port">Local Port</Label>
            <Input
              id="port"
              type="number"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder={defaultPorts[type]}
              className="font-mono"
              min={1}
              max={65535}
            />
            <p className="text-xs text-muted-foreground">
              Traffic will be forwarded to <span className="font-mono text-secondary-foreground">localhost:{port || defaultPorts[type]}</span>
              {" — "}{portHints[type]}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Auto-Expire</Label>
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger className="font-mono text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Never</SelectItem>
                <SelectItem value="1">1 hour</SelectItem>
                <SelectItem value="6">6 hours</SelectItem>
                <SelectItem value="24">24 hours</SelectItem>
                <SelectItem value="72">3 days</SelectItem>
                <SelectItem value="168">7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate} className="w-full" disabled={creating}>
            {creating ? "Creating..." : "Create Tunnel"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
