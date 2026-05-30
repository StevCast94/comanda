import { useState, useEffect, useCallback, useMemo, createContext, useContext } from "react";
import type { User, UserRole } from "../types";
import { auth as authApi } from "../services/api";

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  isRole: (...roles: UserRole[]) => boolean;
  redirectPath: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuthProvider(): AuthContextType {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    loading: true,
    error: null,
  });

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem("comanda_token");
    const userStr = localStorage.getItem("comanda_user");

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        setState({ user, token, loading: false, error: null });

        // Verify token is still valid
        authApi.me().then(({ user: fresh }) => {
          localStorage.setItem("comanda_user", JSON.stringify(fresh));
          setState((s) => ({ ...s, user: fresh }));
        }).catch(() => {
          // Token expired
          localStorage.removeItem("comanda_token");
          localStorage.removeItem("comanda_user");
          setState({ user: null, token: null, loading: false, error: null });
        });
      } catch {
        setState({ user: null, token: null, loading: false, error: null });
      }
    } else {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { token, user } = await authApi.login(username, password);
      localStorage.setItem("comanda_token", token);
      localStorage.setItem("comanda_user", JSON.stringify(user));
      setState({ user, token, loading: false, error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error de conexión";
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("comanda_token");
    localStorage.removeItem("comanda_user");
    setState({ user: null, token: null, loading: false, error: null });
    window.location.hash = "#/login";
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  const isRole = useCallback((...roles: UserRole[]) => {
    if (!state.user) return false;
    if (state.user.role === "SUPERADMIN") return true;
    return roles.includes(state.user.role);
  }, [state.user]);

  // Where to redirect after login based on role
  const redirectPath = useMemo(() => {
    if (!state.user) return "/login";
    switch (state.user.role) {
      case "SUPERADMIN": return "/superadmin";
      case "ADMIN": return "/admin";
      case "CASHIER": return "/pos";
      case "COOK_1":
      case "COOK_2": return "/kitchen";
      case "WAITER": return "/waiter";
      case "DELIVERY": return "/delivery";
      default: return "/login";
    }
  }, [state.user]);

  return { ...state, login, logout, clearError, isRole, redirectPath };
}

export { AuthContext };

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
