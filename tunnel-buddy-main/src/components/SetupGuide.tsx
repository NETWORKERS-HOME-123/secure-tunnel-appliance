import { Copy, Terminal } from "lucide-react";
import { toast } from "sonner";

const installCmd = "curl -fsSL https://get.ultraslim.io | sh";
const runCmd = "ultraslim connect --token YOUR_AUTH_TOKEN";

function CopyBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          toast.success("Copied");
        }}
        className="group flex w-full items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-left font-mono text-sm text-foreground transition-all hover:border-primary/30"
      >
        <span className="truncate">{code}</span>
        <Copy className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  );
}

export function SetupGuide() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Terminal className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Quick Setup</h3>
      </div>
      <CopyBlock label="1. Install the agent" code={installCmd} />
      <CopyBlock label="2. Connect to relay" code={runCmd} />
    </div>
  );
}
