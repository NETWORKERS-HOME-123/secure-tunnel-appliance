/**
 * Mock / dummy API layer for testing.
 * Toggle via the USE_MOCK_API flag below.
 */

export const USE_MOCK_API = true;

// --------------- Tunnels ---------------

let nextTunnelIdx = 1;

function makeTunnel(overrides: Partial<MockTunnel> = {}): MockTunnel {
  const idx = nextTunnelIdx++;
  const types = ["http", "tcp", "ssh", "rdp", "udp", "ws"] as const;
  const type = overrides.type ?? types[idx % types.length];
  const slug = Math.random().toString(36).slice(2, 6);
  const tunnelId = overrides.tunnel_id ?? `tn_${Math.random().toString(36).slice(2, 10)}`;
  const relayPort = 40000 + Math.floor(Math.random() * 10000);
  const endpointMap: Record<string, string> = {
    http: `https://${slug}.ultraslim.io`,
    tcp: `tcp://relay.ultraslim.io:${relayPort}`,
    ssh: `ssh://relay.ultraslim.io:${relayPort}`,
    rdp: `rdp://relay.ultraslim.io:${relayPort}`,
    udp: `udp://relay.ultraslim.io:${relayPort}`,
    ws: `wss://${slug}.ultraslim.io`,
  };

  return {
    id: crypto.randomUUID(),
    user_id: "mock-user",
    tunnel_id: tunnelId,
    type,
    local_port: overrides.local_port ?? [3000, 5432, 22, 8080, 3389, 5000][idx % 6],
    public_endpoint: endpointMap[type],
    status: overrides.status ?? (Math.random() > 0.3 ? "online" : "offline"),
    bytes_in: Math.floor(Math.random() * 50_000_000),
    bytes_out: Math.floor(Math.random() * 30_000_000),
    connections: Math.floor(Math.random() * 500),
    created_at: new Date(Date.now() - Math.floor(Math.random() * 7 * 86400000)).toISOString(),
    updated_at: new Date().toISOString(),
    expires_at: Math.random() > 0.5 ? new Date(Date.now() + 3600000 * 24).toISOString() : null,
  };
}

export interface MockTunnel {
  id: string;
  user_id: string;
  tunnel_id: string;
  type: "http" | "tcp" | "ssh" | "rdp" | "udp" | "ws";
  local_port: number;
  public_endpoint: string;
  status: "online" | "offline";
  bytes_in: number;
  bytes_out: number;
  connections: number;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

// Seed data
let mockTunnels: MockTunnel[] = [
  makeTunnel({ type: "http", local_port: 3000, status: "online" }),
  makeTunnel({ type: "tcp", local_port: 5432, status: "online" }),
  makeTunnel({ type: "ssh", local_port: 22, status: "offline" }),
  makeTunnel({ type: "ws", local_port: 8080, status: "online" }),
];

export const mockApi = {
  // ---------- Tunnels ----------
  getTunnels: async (): Promise<MockTunnel[]> => {
    await delay(300);
    return [...mockTunnels];
  },

  createTunnel: async (type: MockTunnel["type"], localPort: number, expiresInHours?: number): Promise<MockTunnel> => {
    await delay(400);
    if (mockTunnels.length >= 5) throw new Error("Tunnel limit reached");
    const t = makeTunnel({
      type,
      local_port: localPort,
      status: "online",
      expires_at: expiresInHours ? new Date(Date.now() + expiresInHours * 3600000).toISOString() : null,
    });
    mockTunnels = [t, ...mockTunnels];
    return t;
  },

  deleteTunnel: async (id: string): Promise<void> => {
    await delay(200);
    mockTunnels = mockTunnels.filter((t) => t.id !== id);
  },

  // ---------- Connection Logs ----------
  getConnectionLogs: async (tunnelId?: string, limit = 100): Promise<MockConnectionLog[]> => {
    await delay(350);
    let logs = generateConnectionLogs(limit);
    if (tunnelId && tunnelId !== "all") {
      logs = logs.filter((l) => l.tunnel_id === tunnelId);
    }
    return logs;
  },

  // ---------- Health Checks ----------
  getHealthChecks: async (tunnels: MockTunnel[]): Promise<MockHealthStatus[]> => {
    await delay(500);
    return tunnels.map((t) => ({
      tunnel_id: t.id,
      tunnel_name: t.tunnel_id,
      status: t.status === "online" ? (Math.random() > 0.15 ? "healthy" : "degraded") : "down",
      latency_ms: t.status === "online" ? Math.floor(Math.random() * 80) + 3 : null,
      last_check: new Date().toISOString(),
      type: t.type,
    }));
  },

  // ---------- API Keys ----------
  apiKeys: [] as MockApiKey[],

  getApiKeys: async (): Promise<MockApiKey[]> => {
    await delay(250);
    return [...mockApi.apiKeys];
  },

  createApiKey: async (name: string): Promise<{ key: MockApiKey; rawKey: string }> => {
    await delay(300);
    const rawKey = `usk_mock_${Math.random().toString(36).slice(2, 30)}`;
    const k: MockApiKey = {
      id: crypto.randomUUID(),
      name,
      key_prefix: rawKey.slice(0, 8) + "...",
      key_hash: "mock-hash",
      last_used_at: null,
      expires_at: null,
      revoked: false,
      created_at: new Date().toISOString(),
    };
    mockApi.apiKeys.unshift(k);
    return { key: k, rawKey };
  },

  revokeApiKey: async (id: string): Promise<void> => {
    await delay(200);
    mockApi.apiKeys = mockApi.apiKeys.map((k) => (k.id === id ? { ...k, revoked: true } : k));
  },

  deleteApiKey: async (id: string): Promise<void> => {
    await delay(200);
    mockApi.apiKeys = mockApi.apiKeys.filter((k) => k.id !== id);
  },
};

// --------------- Types ---------------

export interface MockConnectionLog {
  id: string;
  tunnel_id: string;
  user_id: string;
  method: string | null;
  path: string | null;
  status_code: number | null;
  latency_ms: number | null;
  bytes_transferred: number;
  source_ip: string | null;
  created_at: string;
}

export interface MockHealthStatus {
  tunnel_id: string;
  tunnel_name: string;
  status: "healthy" | "degraded" | "down";
  latency_ms: number | null;
  last_check: string;
  type: string;
}

export interface MockApiKey {
  id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
}

// --------------- Helpers ---------------

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];
const PATHS = ["/", "/api/users", "/api/tunnels", "/health", "/api/data", "/webhook", "/api/config", "/api/logs"];
const STATUS_CODES = [200, 200, 200, 201, 204, 301, 400, 404, 500];
const IPS = ["192.168.1.42", "10.0.0.15", "172.16.0.8", "203.0.113.50", "198.51.100.23"];

function generateConnectionLogs(count: number): MockConnectionLog[] {
  const tunnelIds = mockTunnels.map((t) => t.id);
  if (tunnelIds.length === 0) return [];

  return Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    tunnel_id: tunnelIds[i % tunnelIds.length],
    user_id: "mock-user",
    method: METHODS[Math.floor(Math.random() * METHODS.length)],
    path: PATHS[Math.floor(Math.random() * PATHS.length)],
    status_code: STATUS_CODES[Math.floor(Math.random() * STATUS_CODES.length)],
    latency_ms: Math.floor(Math.random() * 200) + 5,
    bytes_transferred: Math.floor(Math.random() * 100000),
    source_ip: IPS[Math.floor(Math.random() * IPS.length)],
    created_at: new Date(Date.now() - i * 60000 - Math.random() * 30000).toISOString(),
  }));
}

// Seed some API keys
mockApi.apiKeys = [
  {
    id: crypto.randomUUID(),
    name: "CI/CD Pipeline",
    key_prefix: "usk_mock...",
    key_hash: "mock",
    last_used_at: new Date(Date.now() - 3600000).toISOString(),
    expires_at: null,
    revoked: false,
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: crypto.randomUUID(),
    name: "Local Dev",
    key_prefix: "usk_dev_...",
    key_hash: "mock",
    last_used_at: null,
    expires_at: null,
    revoked: true,
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
];
