import { useState, useEffect, useMemo, type ReactNode } from "react";
import { AuthContext, useAuthProvider, useAuth } from "./hooks/useAuth";
import { ThemeProvider, useTheme } from "./hooks/useTheme";
import type { UserRole } from "./types";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import POSPage from "./pages/pos/POSPage";
import KDSPage from "./pages/kitchen/KDSPage";
import WaiterPage from "./pages/waiter/WaiterPage";
import AdminDashboard from "./pages/admin/DashboardPage";
import SuperAdminPage from "./pages/superadmin/SuperDashboardPage";
import { Lock, Sun, Moon } from "lucide-react";
import ChangePasswordModal from "./components/ChangePasswordModal";

// ─── Simple Hash Router ─────────────────────────────────────

function useHashRoute(): string {
  const [hash, setHash] = useState(window.location.hash.slice(1) || "/login");

  useEffect(() => {
    const onChange = () => setHash(window.location.hash.slice(1) || "/login");
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return hash;
}

export function navigate(path: string) {
  window.location.hash = `#${path}`;
}

// ─── Protected Route ────────────────────────────────────────

function Protected({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) {
    navigate("/login");
    return null;
  }
  if (user.role !== "SUPERADMIN" && !roles.includes(user.role)) {
    navigate("/login");
    return null;
  }
  return <>{children}</>;
}

// ─── Loading Screen ─────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-surface">
      <div className="text-center">
        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-text-muted">Cargando Comanda...</p>
      </div>
    </div>
  );
}

// ─── 404 ────────────────────────────────────────────────────

function NotFound() {
  const { user } = useAuth();
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-surface gap-4">
      <p className="text-6xl font-bold text-accent">404</p>
      <p className="text-text-muted">Página no encontrada</p>
      {user && (
        <button className="btn btn-primary" onClick={() => navigate(user.role === "SUPERADMIN" ? "/superadmin" : "/admin")}>
          Ir al inicio
        </button>
      )}
    </div>
  );
}

// ─── Router ─────────────────────────────────────────────────

function AppRouter() {
  const route = useHashRoute();
  const { user, loading } = useAuth();

  // Auto-redirect authenticated users away from login
  useEffect(() => {
    if (!loading && user && (route === "/login" || route === "/")) {
      const target = (() => {
        switch (user.role) {
          case "SUPERADMIN": return "/superadmin";
          case "ADMIN": return "/admin";
          case "CASHIER": return "/pos";
          case "COOK_1": case "COOK_2": return "/kitchen";
          case "WAITER": return "/waiter";
          case "DELIVERY": return "/delivery";
          default: return "/login";
        }
      })();
      navigate(target);
    }
  }, [user, loading, route]);

  const page = useMemo(() => {
    // Public routes
    if (route === "/login" || route === "/") return <LoginPage />;
    if (route === "/registro") return <RegisterPage />;

    // Protected routes
    if (route === "/pos")
      return <Protected roles={["CASHIER", "ADMIN"]}><POSPage /></Protected>;
    if (route === "/kitchen")
      return <Protected roles={["COOK_1", "COOK_2", "ADMIN"]}><KDSPage /></Protected>;
    if (route === "/waiter")
      return <Protected roles={["WAITER", "ADMIN"]}><WaiterPage /></Protected>;
    if (route.startsWith("/admin"))
      return <Protected roles={["ADMIN"]}><AdminDashboard /></Protected>;
    if (route.startsWith("/superadmin"))
      return <Protected roles={["SUPERADMIN"]}><SuperAdminPage /></Protected>;
    if (route === "/delivery")
      return <Protected roles={["DELIVERY", "ADMIN"]}><div className="p-8 text-text-muted">Panel Delivery — Fase 3</div></Protected>;

    return <NotFound />;
  }, [route]);

  if (loading) return <LoadingScreen />;
  return page;
}

// ─── Global Password Change Button ─────────────────────────

function GlobalPasswordButton() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  if (!user || user.role === "SUPERADMIN") return null;

  return (
    <>
      <button
        onClick={() => setShow(true)}
        className="fixed bottom-6 left-6 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 border border-border shadow-lg hover:bg-surface-3 transition"
        title="Cambiar contraseña"
      >
        <Lock className="h-4 w-4 text-text-muted" />
      </button>
      {show && <ChangePasswordModal onClose={() => setShow(false)} />}
    </>
  );
}

// ─── App ────────────────────────────────────────────────────

function ThemeToggleButton() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="fixed bottom-6 right-6 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 border border-border shadow-lg hover:bg-surface-3 transition"
      title={theme === "light" ? "Modo oscuro" : "Modo claro"}
    >
      {theme === "light" ? (
        <Moon className="h-4 w-4 text-text-muted" />
      ) : (
        <Sun className="h-4 w-4 text-text-muted" />
      )}
    </button>
  );
}

export default function App() {
  const auth = useAuthProvider();

  return (
    <ThemeProvider>
      <AuthContext.Provider value={auth}>
        <AppRouter />
        <GlobalPasswordButton />
        <ThemeToggleButton />
      </AuthContext.Provider>
    </ThemeProvider>
  );
}
