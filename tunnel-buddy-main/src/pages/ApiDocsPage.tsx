import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, Key, Webhook, Activity, Globe } from "lucide-react";

const endpoints = [
  {
    method: "GET",
    path: "/v1/tunnels",
    description: "List all tunnels for the authenticated user",
    auth: "API Key",
    response: `{
  "tunnels": [
    {
      "id": "uuid",
      "tunnel_id": "tn_abc12345",
      "type": "http",
      "status": "online",
      "local_port": 3000,
      "public_endpoint": "https://slug.ultraslim.io",
      "bytes_in": 1024,
      "bytes_out": 2048,
      "connections": 42,
      "created_at": "2026-01-15T10:00:00Z"
    }
  ]
}`,
  },
  {
    method: "POST",
    path: "/v1/tunnels",
    description: "Create a new tunnel",
    auth: "API Key",
    body: `{
  "type": "http",
  "local_port": 3000,
  "expires_in_hours": 24
}`,
    response: `{
  "tunnel": {
    "id": "uuid",
    "tunnel_id": "tn_xyz98765",
    "public_endpoint": "https://new-slug.ultraslim.io",
    "status": "online"
  }
}`,
  },
  {
    method: "DELETE",
    path: "/v1/tunnels/:id",
    description: "Delete a tunnel by ID",
    auth: "API Key",
    response: `{ "success": true }`,
  },
  {
    method: "GET",
    path: "/v1/tunnels/:id/logs",
    description: "Get connection logs for a specific tunnel",
    auth: "API Key",
    response: `{
  "logs": [
    {
      "method": "GET",
      "path": "/api/users",
      "status_code": 200,
      "latency_ms": 12,
      "bytes_transferred": 4096,
      "created_at": "2026-01-15T10:05:00Z"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/v1/status",
    description: "Get system status and active incidents",
    auth: "None",
    response: `{
  "status": "operational",
  "components": {
    "relay": "operational",
    "api": "operational",
    "dashboard": "operational"
  }
}`,
  },
];

const methodColors: Record<string, string> = {
  GET: "bg-primary/10 text-primary",
  POST: "bg-tunnel-http/20 text-tunnel-http",
  DELETE: "bg-destructive/10 text-destructive",
  PUT: "bg-tunnel-tcp/20 text-tunnel-tcp",
  PATCH: "bg-accent/10 text-accent",
};

export default function ApiDocsPage() {
  return (
    <DashboardLayout>
      <div className="container max-w-4xl py-8 space-y-8">
        <div className="flex items-center gap-3">
          <Code className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">API Reference</h1>
          <Badge variant="outline" className="font-mono text-xs">v1</Badge>
        </div>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm">Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              All authenticated endpoints require an API key passed in the <code className="text-primary">Authorization</code> header.
            </p>
            <div className="rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs">
              <span className="text-muted-foreground">Authorization:</span>{" "}
              <span className="text-primary">Bearer usk_your_api_key_here</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Generate API keys from <strong>Settings → API Keys</strong>. Keys use the <code className="text-primary">usk_</code> prefix and are SHA-256 hashed at rest.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Endpoints</h2>
          {endpoints.map((ep, i) => (
            <Card key={i} className="border-border">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge className={`font-mono text-xs ${methodColors[ep.method] || ""}`}>{ep.method}</Badge>
                  <code className="font-mono text-sm text-foreground">{ep.path}</code>
                  {ep.auth !== "None" && (
                    <Badge variant="outline" className="text-[10px] gap-1"><Key className="h-2.5 w-2.5" /> {ep.auth}</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{ep.description}</p>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="response" className="space-y-2">
                  <TabsList className="h-7">
                    {ep.body && <TabsTrigger value="body" className="text-xs h-6">Request Body</TabsTrigger>}
                    <TabsTrigger value="response" className="text-xs h-6">Response</TabsTrigger>
                  </TabsList>
                  {ep.body && (
                    <TabsContent value="body">
                      <pre className="rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs overflow-x-auto">{ep.body}</pre>
                    </TabsContent>
                  )}
                  <TabsContent value="response">
                    <pre className="rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs overflow-x-auto">{ep.response}</pre>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Webhook Events</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-xs font-mono">
              {["tunnel.created", "tunnel.deleted", "tunnel.online", "tunnel.offline"].map((ev) => (
                <div key={ev} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                  <Activity className="h-3 w-3 text-primary" />
                  <span>{ev}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Webhook payloads are signed with your webhook secret using HMAC-SHA256 in the <code className="text-primary">X-Signature</code> header.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-sm">Rate Limits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 pr-4">Tier</th>
                    <th className="text-left py-2 pr-4">Requests/min</th>
                    <th className="text-left py-2">Burst</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50"><td className="py-1.5 pr-4">Free</td><td className="py-1.5 pr-4">60</td><td className="py-1.5">10</td></tr>
                  <tr className="border-b border-border/50"><td className="py-1.5 pr-4">Pro</td><td className="py-1.5 pr-4">300</td><td className="py-1.5">50</td></tr>
                  <tr><td className="py-1.5 pr-4">Team</td><td className="py-1.5 pr-4">1000</td><td className="py-1.5">100</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
