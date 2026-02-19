import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api, type User } from "@/lib/api";

export type Profile = User;

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const data = await api.profile.get();
        setProfile(data);
      } catch {
        setProfile(user);
      }
      setLoading(false);
    };

    fetchProfile();
  }, [user]);

  return { profile, loading };
}
