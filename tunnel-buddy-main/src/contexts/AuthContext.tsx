import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type User } from "@/lib/api";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    if (!api.auth.isAuthenticated()) {
      setUser(null);
      setLoading(false);
      return;
    }

    // First try stored user for instant load
    const stored = api.auth.getStoredUser();
    if (stored) {
      setUser(stored);
      setLoading(false);
    }

    // Then validate token by fetching profile
    try {
      const profile = await api.profile.get();
      setUser(profile);
      setLoading(false);
    } catch {
      // Token invalid
      setUser(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();

    // Listen for storage changes (multi-tab logout)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'ultraslim_token') {
        loadUser();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const signOut = () => {
    api.auth.signOut();
    setUser(null);
  };

  const refreshUser = async () => {
    await loadUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
