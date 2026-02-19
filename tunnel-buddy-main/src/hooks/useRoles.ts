import { useAuth } from "@/contexts/AuthContext";

export function useRoles() {
  const { user } = useAuth();

  const role = user?.role ?? "user";
  const isSuperAdmin = role === "superadmin";
  const isAdmin = role === "admin" || isSuperAdmin;

  return { roles: [role], isSuperAdmin, isAdmin, loading: false };
}
