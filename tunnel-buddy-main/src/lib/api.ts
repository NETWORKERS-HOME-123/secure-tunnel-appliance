// UltraSlim API Client — replaces all Supabase calls

const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken(): string | null {
  return localStorage.getItem('ultraslim_token');
}

function setToken(token: string) {
  localStorage.setItem('ultraslim_token', token);
}

function clearToken() {
  localStorage.removeItem('ultraslim_token');
  localStorage.removeItem('ultraslim_user');
}

function getStoredUser() {
  const raw = localStorage.getItem('ultraslim_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function setStoredUser(user: any) {
  localStorage.setItem('ultraslim_user', JSON.stringify(user));
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/auth';
    throw new Error('Unauthorized');
  }

  return res;
}

async function apiJSON<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, opts);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || res.statusText);
  }
  return res.json();
}

// ── Auth ─────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string;
  max_tunnels: number;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const api = {
  auth: {
    async login(email: string, password: string): Promise<AuthResponse> {
      const data = await apiJSON<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      setStoredUser(data.user);
      return data;
    },

    async signup(email: string, password: string, displayName: string): Promise<AuthResponse> {
      const data = await apiJSON<AuthResponse>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, display_name: displayName }),
      });
      setToken(data.token);
      setStoredUser(data.user);
      return data;
    },

    async forgotPassword(email: string) {
      return apiJSON('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    async resetPassword(email: string, newPassword: string) {
      return apiJSON('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, new_password: newPassword }),
      });
    },

    async refresh(): Promise<{ token: string }> {
      const data = await apiJSON<{ token: string }>('/api/auth/refresh', { method: 'POST' });
      setToken(data.token);
      return data;
    },

    signOut() {
      clearToken();
      window.location.href = '/auth';
    },

    getToken,
    getStoredUser,
    isAuthenticated(): boolean {
      return !!getToken();
    },
  },

  // ── Profile ──────────────────────────────────────────

  profile: {
    async get(): Promise<User> {
      return apiJSON<User>('/api/profile');
    },

    async update(data: { display_name?: string; avatar_url?: string }) {
      return apiJSON('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
  },

  // ── Tunnels ──────────────────────────────────────────

  tunnels: {
    async list(): Promise<Tunnel[]> {
      return apiJSON<Tunnel[]>('/api/tunnels');
    },

    async delete(id: string) {
      return apiJSON(`/api/tunnels/${id}`, { method: 'DELETE' });
    },

    async health(id: string) {
      return apiJSON(`/api/tunnels/${id}/health`);
    },
  },

  // ── API Keys ─────────────────────────────────────────

  apiKeys: {
    async list() {
      return apiJSON('/api/api-keys');
    },

    async create(name: string, expiresAt?: string) {
      return apiJSON('/api/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name, expires_at: expiresAt }),
      });
    },

    async delete(id: string) {
      return apiJSON(`/api/api-keys/${id}`, { method: 'DELETE' });
    },
  },

  // ── Webhooks ─────────────────────────────────────────

  webhooks: {
    async list() {
      return apiJSON('/api/webhooks');
    },

    async create(name: string, url: string, events: string[]) {
      return apiJSON('/api/webhooks', {
        method: 'POST',
        body: JSON.stringify({ name, url, events }),
      });
    },

    async update(id: string, data: { active?: boolean }) {
      return apiJSON(`/api/webhooks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async delete(id: string) {
      return apiJSON(`/api/webhooks/${id}`, { method: 'DELETE' });
    },
  },

  // ── Notifications ────────────────────────────────────

  notifications: {
    async list() {
      return apiJSON('/api/notifications');
    },

    async markRead(id: string) {
      return apiJSON(`/api/notifications/${id}/read`, { method: 'PATCH' });
    },

    async markAllRead() {
      return apiJSON('/api/notifications/read-all', { method: 'POST' });
    },

    async clearAll() {
      return apiJSON('/api/notifications', { method: 'DELETE' });
    },
  },

  // ── Analytics ────────────────────────────────────────

  analytics: {
    async stats() {
      return apiJSON('/api/analytics');
    },

    async connectionLogs(tunnelId?: string, limit = 500) {
      const params = new URLSearchParams();
      if (tunnelId && tunnelId !== 'all') params.set('tunnel_id', tunnelId);
      params.set('limit', String(limit));
      return apiJSON(`/api/analytics/connections?${params}`);
    },
  },

  // ── Config ───────────────────────────────────────────

  config: {
    async export() {
      return apiJSON('/api/config/export');
    },
  },

  // ── Password ──────────────────────────────────────────

  password: {
    async change(newPassword: string) {
      return apiJSON('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword }),
      });
    },

    async resetWithToken(token: string, newPassword: string) {
      return apiJSON('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: newPassword }),
      });
    },
  },

  // ── Sessions ──────────────────────────────────────────

  sessions: {
    async signOutAll() {
      return apiJSON('/api/auth/sign-out-all', { method: 'POST' });
    },

    async signOutOthers() {
      return apiJSON('/api/auth/sign-out-others', { method: 'POST' });
    },
  },

  // ── Audit Logs ────────────────────────────────────────

  auditLogs: {
    async list(limit = 20) {
      return apiJSON(`/api/audit-logs?limit=${limit}`);
    },
  },

  // ── Teams ─────────────────────────────────────────────

  teams: {
    async list() {
      return apiJSON('/api/teams');
    },

    async create(name: string, slug: string) {
      return apiJSON('/api/teams', {
        method: 'POST',
        body: JSON.stringify({ name, slug }),
      });
    },

    async delete(id: string) {
      return apiJSON(`/api/teams/${id}`, { method: 'DELETE' });
    },

    async invite(teamId: string, email: string) {
      return apiJSON(`/api/teams/${teamId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    async members(teamId: string) {
      return apiJSON(`/api/teams/${teamId}/members`);
    },
  },

  // ── Subdomains ────────────────────────────────────────

  subdomains: {
    async list() {
      return apiJSON('/api/subdomains');
    },

    async claim(subdomain: string) {
      return apiJSON('/api/subdomains', {
        method: 'POST',
        body: JSON.stringify({ subdomain }),
      });
    },

    async delete(id: string) {
      return apiJSON(`/api/subdomains/${id}`, { method: 'DELETE' });
    },

    async link(id: string, tunnelId: string | null) {
      return apiJSON(`/api/subdomains/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ tunnel_id: tunnelId }),
      });
    },
  },

  // ── Status / Incidents ────────────────────────────────

  status: {
    async incidents() {
      return apiJSON('/api/status/incidents');
    },
  },

  // ── Webhook Deliveries ────────────────────────────────

  webhookDeliveries: {
    async list(webhookId: string) {
      return apiJSON(`/api/webhooks/${webhookId}/deliveries`);
    },

    async retry(webhookId: string, deliveryId: string) {
      return apiJSON(`/api/webhooks/${webhookId}/deliveries/${deliveryId}/retry`, {
        method: 'POST',
      });
    },
  },

  // ── Admin ────────────────────────────────────────────

  admin: {
    async getUsers() {
      return apiJSON('/api/admin/users');
    },

    async assignRole(userId: string, role: string) {
      return apiJSON('/api/admin/roles', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, role }),
      });
    },

    async getAllTunnels() {
      return apiJSON('/api/admin/tunnels');
    },

    async deleteTunnel(id: string) {
      return apiJSON(`/api/admin/tunnels/${id}`, { method: 'DELETE' });
    },

    async getAuditLogs() {
      return apiJSON('/api/admin/audit-logs');
    },
  },

  // ── System Health ────────────────────────────────────

  async health() {
    return apiJSON('/api/health');
  },
};

// ── Types ──────────────────────────────────────────────

export interface Tunnel {
  id: string;
  user_id: string;
  tunnel_id: string;
  type: string;
  local_port: number;
  public_endpoint: string;
  status: string;
  bytes_in: number;
  bytes_out: number;
  connections: number;
  assigned_port: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── WebSocket Realtime ─────────────────────────────────

export function connectRealtime(onEvent: (event: any) => void): WebSocket | null {
  const token = getToken();
  if (!token) return null;

  const wsBase = API_BASE.replace(/^https/, 'wss').replace(/^http/, 'ws') || `wss://${window.location.host}`;
  const ws = new WebSocket(`${wsBase}/ws/realtime?token=${token}`);

  ws.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      onEvent(data);
    } catch {}
  };

  ws.onclose = () => {
    // Reconnect after 5 seconds
    setTimeout(() => {
      connectRealtime(onEvent);
    }, 5000);
  };

  return ws;
}

export default api;
