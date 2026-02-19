import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { api, connectRealtime, type Tunnel } from "@/lib/api";

export type { Tunnel };

export function useTunnels() {
  const { user } = useAuth();
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTunnels = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.tunnels.list();
      setTunnels(data);
    } catch (e: any) {
      toast.error("Failed to load tunnels");
      console.error(e);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTunnels();
  }, [fetchTunnels]);

  // Real-time subscription via WebSocket
  useEffect(() => {
    if (!user) return;

    const ws = connectRealtime((event) => {
      if (event.table === "tunnels") {
        fetchTunnels();
      }
    });

    return () => {
      ws?.close();
    };
  }, [user, fetchTunnels]);

  const createTunnel = async (
    type: "http" | "tcp" | "ssh" | "rdp" | "udp" | "ws",
    localPort: number,
    _expiresInHours?: number
  ) => {
    if (!user) return;
    toast.info(
      `To create a ${type.toUpperCase()} tunnel on port ${localPort}, run:\n\nultraslim connect ${localPort} --type ${type}`,
      { duration: 8000 }
    );
  };

  const deleteTunnel = async (id: string) => {
    try {
      await api.tunnels.delete(id);
      setTunnels((prev) => prev.filter((t) => t.id !== id));
      toast.success("Tunnel deleted");
    } catch (e: any) {
      toast.error("Failed to delete tunnel");
      console.error(e);
    }
  };

  return { tunnels, loading, createTunnel, deleteTunnel };
}
